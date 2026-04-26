const { expect } = require("chai");
const { ethers } = require("hardhat");

const TOPIC_KYC = 1n;
const TOPIC_ACCREDITATION = 7n;
const SCHEME_ECDSA = 1n;
const COUNTRY_US = 840;

async function signClaim(signer, identityAddress, topic, data) {
  const dataHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes"],
      [identityAddress, topic, data],
    ),
  );
  return signer.signMessage(ethers.getBytes(dataHash));
}

async function deployStack() {
  const [admin, agent, kycIssuer, accreditationIssuer, user, other, rogueIssuer] =
    await ethers.getSigners();

  const ClaimTopics = await ethers.getContractFactory("ClaimTopicsRegistry");
  const claimTopics = await ClaimTopics.deploy(admin.address);
  await claimTopics.waitForDeployment();

  const TrustedIssuers = await ethers.getContractFactory("TrustedIssuersRegistry");
  const trustedIssuers = await TrustedIssuers.deploy(admin.address);
  await trustedIssuers.waitForDeployment();

  const Registry = await ethers.getContractFactory("IdentityRegistry");
  const registry = await Registry.deploy(
    admin.address,
    await claimTopics.getAddress(),
    await trustedIssuers.getAddress(),
  );
  await registry.waitForDeployment();

  await registry.connect(admin).grantRole(await registry.AGENT_ROLE(), agent.address);

  const Identity = await ethers.getContractFactory("Identity");
  const userIdentity = await Identity.deploy(user.address);
  await userIdentity.waitForDeployment();

  return {
    admin,
    agent,
    kycIssuer,
    accreditationIssuer,
    user,
    other,
    rogueIssuer,
    claimTopics,
    trustedIssuers,
    registry,
    userIdentity,
  };
}

describe("IdentityRegistry", function () {
  describe("constructor", function () {
    it("reverts on zero-address registries", async function () {
      const [admin] = await ethers.getSigners();
      const Registry = await ethers.getContractFactory("IdentityRegistry");
      await expect(
        Registry.deploy(admin.address, ethers.ZeroAddress, ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(Registry, "ZeroAddressRegistry");
    });

    it("grants admin both DEFAULT_ADMIN_ROLE and AGENT_ROLE", async function () {
      const { admin, registry } = await deployStack();
      expect(await registry.hasRole(await registry.DEFAULT_ADMIN_ROLE(), admin.address)).to.equal(true);
      expect(await registry.hasRole(await registry.AGENT_ROLE(), admin.address)).to.equal(true);
    });

    it("emits ClaimTopicsRegistrySet and TrustedIssuersRegistrySet on deploy", async function () {
      const [admin] = await ethers.getSigners();

      const ClaimTopics = await ethers.getContractFactory("ClaimTopicsRegistry");
      const claimTopics = await ClaimTopics.deploy(admin.address);
      await claimTopics.waitForDeployment();

      const TrustedIssuers = await ethers.getContractFactory("TrustedIssuersRegistry");
      const trustedIssuers = await TrustedIssuers.deploy(admin.address);
      await trustedIssuers.waitForDeployment();

      const Registry = await ethers.getContractFactory("IdentityRegistry");
      const tx = Registry.deploy(
        admin.address,
        await claimTopics.getAddress(),
        await trustedIssuers.getAddress(),
      );

      const deployed = await tx;
      const receipt = await deployed.deploymentTransaction().wait();
      const events = receipt.logs.map((l) => {
        try {
          return deployed.interface.parseLog(l);
        } catch {
          return null;
        }
      });
      const setNames = events.filter((e) => e !== null).map((e) => e.name);
      expect(setNames).to.include("ClaimTopicsRegistrySet");
      expect(setNames).to.include("TrustedIssuersRegistrySet");
    });
  });

  describe("registerIdentity", function () {
    it("stores wallet -> identity binding and country code", async function () {
      const { agent, user, registry, userIdentity } = await deployStack();
      await registry
        .connect(agent)
        .registerIdentity(user.address, await userIdentity.getAddress(), COUNTRY_US);

      expect(await registry.identity(user.address)).to.equal(await userIdentity.getAddress());
      expect(await registry.investorCountry(user.address)).to.equal(COUNTRY_US);
    });

    it("emits IdentityRegistered", async function () {
      const { agent, user, registry, userIdentity } = await deployStack();
      const idAddr = await userIdentity.getAddress();

      await expect(
        registry.connect(agent).registerIdentity(user.address, idAddr, COUNTRY_US),
      )
        .to.emit(registry, "IdentityRegistered")
        .withArgs(user.address, idAddr, COUNTRY_US);
    });

    it("reverts on zero-address user, zero-address identity, and double registration", async function () {
      const { agent, user, registry, userIdentity } = await deployStack();
      const idAddr = await userIdentity.getAddress();

      await expect(
        registry.connect(agent).registerIdentity(ethers.ZeroAddress, idAddr, COUNTRY_US),
      ).to.be.revertedWithCustomError(registry, "ZeroAddressUser");

      await expect(
        registry.connect(agent).registerIdentity(user.address, ethers.ZeroAddress, COUNTRY_US),
      ).to.be.revertedWithCustomError(registry, "ZeroAddressIdentity");

      await registry.connect(agent).registerIdentity(user.address, idAddr, COUNTRY_US);
      await expect(
        registry.connect(agent).registerIdentity(user.address, idAddr, COUNTRY_US),
      )
        .to.be.revertedWithCustomError(registry, "IdentityAlreadyRegistered")
        .withArgs(user.address);
    });

    it("rejects callers without AGENT_ROLE", async function () {
      const { other, user, registry, userIdentity } = await deployStack();
      await expect(
        registry
          .connect(other)
          .registerIdentity(user.address, await userIdentity.getAddress(), COUNTRY_US),
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });
  });

  describe("deleteIdentity / updateIdentity / updateCountry", function () {
    it("clears the binding and the country code on delete", async function () {
      const { agent, user, registry, userIdentity } = await deployStack();
      await registry
        .connect(agent)
        .registerIdentity(user.address, await userIdentity.getAddress(), COUNTRY_US);

      await registry.connect(agent).deleteIdentity(user.address);
      expect(await registry.identity(user.address)).to.equal(ethers.ZeroAddress);
      expect(await registry.investorCountry(user.address)).to.equal(0);
    });

    it("reverts deleteIdentity for an unregistered user", async function () {
      const { agent, user, registry } = await deployStack();
      await expect(registry.connect(agent).deleteIdentity(user.address))
        .to.be.revertedWithCustomError(registry, "IdentityNotRegistered")
        .withArgs(user.address);
    });

    it("replaces the bound identity on updateIdentity", async function () {
      const { agent, user, registry, userIdentity } = await deployStack();
      const Identity = await ethers.getContractFactory("Identity");
      const replacement = await Identity.deploy(user.address);
      await replacement.waitForDeployment();

      await registry
        .connect(agent)
        .registerIdentity(user.address, await userIdentity.getAddress(), COUNTRY_US);
      await registry.connect(agent).updateIdentity(user.address, await replacement.getAddress());

      expect(await registry.identity(user.address)).to.equal(await replacement.getAddress());
    });

    it("updates the country code", async function () {
      const { agent, user, registry, userIdentity } = await deployStack();
      await registry
        .connect(agent)
        .registerIdentity(user.address, await userIdentity.getAddress(), COUNTRY_US);
      await registry.connect(agent).updateCountry(user.address, 124);

      expect(await registry.investorCountry(user.address)).to.equal(124);
    });
  });

  describe("setClaimTopicsRegistry / setTrustedIssuersRegistry", function () {
    it("admin can swap registries; non-admin cannot", async function () {
      const { admin, other, registry } = await deployStack();
      const ClaimTopics = await ethers.getContractFactory("ClaimTopicsRegistry");
      const replacementClaimTopics = await ClaimTopics.deploy(admin.address);
      await replacementClaimTopics.waitForDeployment();

      await registry.connect(admin).setClaimTopicsRegistry(await replacementClaimTopics.getAddress());
      expect(await registry.claimTopicsRegistry()).to.equal(
        await replacementClaimTopics.getAddress(),
      );

      await expect(
        registry.connect(other).setClaimTopicsRegistry(await replacementClaimTopics.getAddress()),
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("rejects zero-address replacement", async function () {
      const { admin, registry } = await deployStack();
      await expect(
        registry.connect(admin).setClaimTopicsRegistry(ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(registry, "ZeroAddressRegistry");
    });
  });

  describe("isVerified", function () {
    it("returns false when no identity is registered", async function () {
      const { other, registry } = await deployStack();
      expect(await registry.isVerified(other.address)).to.equal(false);
    });

    it("returns true with a single valid claim per required topic", async function () {
      const { admin, agent, kycIssuer, user, registry, claimTopics, trustedIssuers, userIdentity } =
        await deployStack();

      await claimTopics.connect(admin).addClaimTopic(TOPIC_KYC);
      await trustedIssuers.connect(admin).addTrustedIssuer(kycIssuer.address, [TOPIC_KYC]);

      const idAddr = await userIdentity.getAddress();
      const data = ethers.toUtf8Bytes("kyc-ref-001");
      const sig = await signClaim(kycIssuer, idAddr, TOPIC_KYC, data);

      await userIdentity
        .connect(user)
        .addClaim(TOPIC_KYC, SCHEME_ECDSA, kycIssuer.address, sig, data, "");
      await registry.connect(agent).registerIdentity(user.address, idAddr, COUNTRY_US);

      expect(await registry.isVerified(user.address)).to.equal(true);
    });

    it("requires every listed topic to have a valid claim", async function () {
      const {
        admin,
        agent,
        kycIssuer,
        accreditationIssuer,
        user,
        registry,
        claimTopics,
        trustedIssuers,
        userIdentity,
      } = await deployStack();

      await claimTopics.connect(admin).addClaimTopic(TOPIC_KYC);
      await claimTopics.connect(admin).addClaimTopic(TOPIC_ACCREDITATION);
      await trustedIssuers.connect(admin).addTrustedIssuer(kycIssuer.address, [TOPIC_KYC]);
      await trustedIssuers
        .connect(admin)
        .addTrustedIssuer(accreditationIssuer.address, [TOPIC_ACCREDITATION]);

      const idAddr = await userIdentity.getAddress();
      const kycData = ethers.toUtf8Bytes("kyc-001");
      const kycSig = await signClaim(kycIssuer, idAddr, TOPIC_KYC, kycData);
      await userIdentity
        .connect(user)
        .addClaim(TOPIC_KYC, SCHEME_ECDSA, kycIssuer.address, kycSig, kycData, "");
      await registry.connect(agent).registerIdentity(user.address, idAddr, COUNTRY_US);

      // KYC present, accreditation missing.
      expect(await registry.isVerified(user.address)).to.equal(false);

      const accData = ethers.toUtf8Bytes("acc-001");
      const accSig = await signClaim(accreditationIssuer, idAddr, TOPIC_ACCREDITATION, accData);
      await userIdentity
        .connect(user)
        .addClaim(TOPIC_ACCREDITATION, SCHEME_ECDSA, accreditationIssuer.address, accSig, accData, "");

      expect(await registry.isVerified(user.address)).to.equal(true);
    });

    it("rejects claims signed by an issuer not trusted for that topic", async function () {
      const {
        admin,
        agent,
        rogueIssuer,
        user,
        registry,
        claimTopics,
        userIdentity,
      } = await deployStack();

      await claimTopics.connect(admin).addClaimTopic(TOPIC_KYC);

      const idAddr = await userIdentity.getAddress();
      const data = ethers.toUtf8Bytes("rogue-kyc");
      const sig = await signClaim(rogueIssuer, idAddr, TOPIC_KYC, data);

      await userIdentity
        .connect(user)
        .addClaim(TOPIC_KYC, SCHEME_ECDSA, rogueIssuer.address, sig, data, "");
      await registry.connect(agent).registerIdentity(user.address, idAddr, COUNTRY_US);

      expect(await registry.isVerified(user.address)).to.equal(false);
    });

    it("rejects claims with a forged signature", async function () {
      const {
        admin,
        agent,
        kycIssuer,
        rogueIssuer,
        user,
        registry,
        claimTopics,
        trustedIssuers,
        userIdentity,
      } = await deployStack();

      await claimTopics.connect(admin).addClaimTopic(TOPIC_KYC);
      await trustedIssuers.connect(admin).addTrustedIssuer(kycIssuer.address, [TOPIC_KYC]);

      const idAddr = await userIdentity.getAddress();
      const data = ethers.toUtf8Bytes("kyc-001");
      // Sign with rogueIssuer but claim it came from kycIssuer.
      const forged = await signClaim(rogueIssuer, idAddr, TOPIC_KYC, data);

      await userIdentity
        .connect(user)
        .addClaim(TOPIC_KYC, SCHEME_ECDSA, kycIssuer.address, forged, data, "");
      await registry.connect(agent).registerIdentity(user.address, idAddr, COUNTRY_US);

      expect(await registry.isVerified(user.address)).to.equal(false);
    });

    it("accepts the first valid claim when multiple issuers attest the same topic", async function () {
      const {
        admin,
        agent,
        kycIssuer,
        rogueIssuer,
        user,
        registry,
        claimTopics,
        trustedIssuers,
        userIdentity,
      } = await deployStack();

      await claimTopics.connect(admin).addClaimTopic(TOPIC_KYC);
      // Trust both, but rogueIssuer's signature will be invalid (signed with wrong key).
      await trustedIssuers.connect(admin).addTrustedIssuer(kycIssuer.address, [TOPIC_KYC]);
      await trustedIssuers.connect(admin).addTrustedIssuer(rogueIssuer.address, [TOPIC_KYC]);

      const idAddr = await userIdentity.getAddress();
      const data = ethers.toUtf8Bytes("kyc-001");

      // First claim: rogue, signed correctly by rogue
      const rogueSig = await signClaim(rogueIssuer, idAddr, TOPIC_KYC, data);
      await userIdentity
        .connect(user)
        .addClaim(TOPIC_KYC, SCHEME_ECDSA, rogueIssuer.address, rogueSig, data, "");

      // Second claim: kyc, signed correctly by kyc
      const kycSig = await signClaim(kycIssuer, idAddr, TOPIC_KYC, data);
      await userIdentity
        .connect(user)
        .addClaim(TOPIC_KYC, SCHEME_ECDSA, kycIssuer.address, kycSig, data, "");

      await registry.connect(agent).registerIdentity(user.address, idAddr, COUNTRY_US);

      // Either claim alone would verify, so isVerified is true.
      expect(await registry.isVerified(user.address)).to.equal(true);
    });
  });
});
