const { expect } = require("chai");
const { ethers } = require("hardhat");

const TOPIC_KYC = 1n;
const SCHEME_ECDSA = 1n;
const COUNTRY_US = 840;
const TIMEOUT = 24 * 60 * 60; // 24h

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
  const [admin, operator, kycIssuer, user, other] = await ethers.getSigners();

  // Identity infra
  const ClaimTopics = await ethers.getContractFactory("ClaimTopicsRegistry");
  const claimTopics = await ClaimTopics.deploy(admin.address);
  await claimTopics.waitForDeployment();
  await claimTopics.connect(admin).addClaimTopic(TOPIC_KYC);

  const TrustedIssuers = await ethers.getContractFactory("TrustedIssuersRegistry");
  const trustedIssuers = await TrustedIssuers.deploy(admin.address);
  await trustedIssuers.waitForDeployment();
  await trustedIssuers.connect(admin).addTrustedIssuer(kycIssuer.address, [TOPIC_KYC]);

  const Registry = await ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await Registry.deploy(
    admin.address,
    await claimTopics.getAddress(),
    await trustedIssuers.getAddress(),
  );
  await identityRegistry.waitForDeployment();

  const Compliance = await ethers.getContractFactory("ModularCompliance");
  const compliance = await Compliance.deploy(admin.address);
  await compliance.waitForDeployment();

  // Deposit asset (cUSDC)
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy(admin.address);
  await usdc.waitForDeployment();

  const Cusdc = await ethers.getContractFactory("cUSDC");
  const cusdc = await Cusdc.deploy(await usdc.getAddress());
  await cusdc.waitForDeployment();

  // Share token
  const Token = await ethers.getContractFactory("GroundVaultToken");
  const shareToken = await Token.deploy(
    admin.address,
    await identityRegistry.getAddress(),
    await compliance.getAddress(),
  );
  await shareToken.waitForDeployment();
  await compliance.connect(admin).bindToken(await shareToken.getAddress());

  // Vault
  const Vault = await ethers.getContractFactory("GroundVaultCore");
  const vault = await Vault.deploy(
    admin.address,
    await identityRegistry.getAddress(),
    await shareToken.getAddress(),
    await cusdc.getAddress(),
    TIMEOUT,
  );
  await vault.waitForDeployment();

  // Vault holds VAULT_ROLE on share token
  await shareToken.connect(admin).grantRole(await shareToken.VAULT_ROLE(), await vault.getAddress());
  await vault.connect(admin).grantRole(await vault.OPERATOR_ROLE(), operator.address);

  // Verify user
  const Identity = await ethers.getContractFactory("Identity");
  const userIdentity = await Identity.deploy(user.address);
  await userIdentity.waitForDeployment();

  const idAddr = await userIdentity.getAddress();
  const data = ethers.toUtf8Bytes("kyc-001");
  const sig = await signClaim(kycIssuer, idAddr, TOPIC_KYC, data);
  await userIdentity
    .connect(user)
    .addClaim(TOPIC_KYC, SCHEME_ECDSA, kycIssuer.address, sig, data, "");
  await identityRegistry.connect(admin).registerIdentity(user.address, idAddr, COUNTRY_US);

  return {
    admin,
    operator,
    user,
    other,
    identityRegistry,
    compliance,
    cusdc,
    shareToken,
    vault,
  };
}

describe("GroundVaultCore (structural)", function () {
  describe("constructor", function () {
    it("rejects zero-address inputs", async function () {
      const [admin] = await ethers.getSigners();
      const Vault = await ethers.getContractFactory("GroundVaultCore");
      await expect(
        Vault.deploy(
          admin.address,
          ethers.ZeroAddress,
          ethers.ZeroAddress,
          ethers.ZeroAddress,
          TIMEOUT,
        ),
      ).to.be.revertedWithCustomError(Vault, "ZeroAddressIdentityRegistry");
    });

    it("grants admin DEFAULT_ADMIN_ROLE and OPERATOR_ROLE", async function () {
      const { admin, vault } = await deployStack();
      expect(await vault.hasRole(await vault.DEFAULT_ADMIN_ROLE(), admin.address)).to.equal(true);
      expect(await vault.hasRole(await vault.OPERATOR_ROLE(), admin.address)).to.equal(true);
    });

    it("exposes the configured pointers", async function () {
      const { vault, identityRegistry, shareToken, cusdc } = await deployStack();
      expect(await vault.identityRegistry()).to.equal(await identityRegistry.getAddress());
      expect(await vault.shareToken()).to.equal(await shareToken.getAddress());
      expect(await vault.depositAsset()).to.equal(await cusdc.getAddress());
      expect(await vault.timeout()).to.equal(TIMEOUT);
    });
  });

  describe("admin", function () {
    it("admin can swap pointers and timeout; non-admin cannot", async function () {
      const { admin, other, vault, identityRegistry, cusdc } = await deployStack();

      await vault.connect(admin).setIdentityRegistry(await identityRegistry.getAddress());
      await vault.connect(admin).setDepositAsset(await cusdc.getAddress());
      await vault.connect(admin).setTimeout(48 * 60 * 60);
      expect(await vault.timeout()).to.equal(48 * 60 * 60);

      await expect(
        vault.connect(other).setTimeout(1),
      ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
    });

    it("admin can pause and unpause", async function () {
      const { admin, vault } = await deployStack();
      await vault.connect(admin).pause();
      expect(await vault.paused()).to.equal(true);
      await vault.connect(admin).unpause();
      expect(await vault.paused()).to.equal(false);
    });

    it("rejects zero-address replacements", async function () {
      const { admin, vault } = await deployStack();
      await expect(
        vault.connect(admin).setIdentityRegistry(ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(vault, "ZeroAddressIdentityRegistry");
      await expect(
        vault.connect(admin).setShareToken(ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(vault, "ZeroAddressShareToken");
      await expect(
        vault.connect(admin).setDepositAsset(ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(vault, "ZeroAddressDepositAsset");
    });
  });

  describe("recordDeposit pre-Nox revert paths", function () {
    const placeholderHandle = ethers.ZeroHash;
    const placeholderProof = "0x";

    it("reverts when caller is not verified", async function () {
      const { other, vault } = await deployStack();
      await expect(
        vault.connect(other).recordDeposit(placeholderHandle, placeholderProof),
      )
        .to.be.revertedWithCustomError(vault, "NotVerified")
        .withArgs(other.address);
    });

    it("reverts when paused", async function () {
      const { admin, user, vault } = await deployStack();
      await vault.connect(admin).pause();
      await expect(
        vault.connect(user).recordDeposit(placeholderHandle, placeholderProof),
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });
  });

  describe("processDeposit pre-Nox revert paths", function () {
    it("reverts when caller is not OPERATOR_ROLE", async function () {
      const { other, user, vault } = await deployStack();
      await expect(
        vault.connect(other).processDeposit(user.address),
      ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
    });

    it("reverts when paused", async function () {
      const { admin, operator, user, vault } = await deployStack();
      await vault.connect(admin).pause();
      await expect(
        vault.connect(operator).processDeposit(user.address),
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });
  });

  describe("claimDeposit pre-Nox revert paths", function () {
    it("reverts when caller is not verified", async function () {
      const { other, vault } = await deployStack();
      await expect(vault.connect(other).claimDeposit())
        .to.be.revertedWithCustomError(vault, "NotVerified")
        .withArgs(other.address);
    });

    it("reverts when paused", async function () {
      const { admin, user, vault } = await deployStack();
      await vault.connect(admin).pause();
      await expect(vault.connect(user).claimDeposit()).to.be.revertedWithCustomError(
        vault,
        "EnforcedPause",
      );
    });
  });

  describe("cancelDepositTimeout", function () {
    it("reverts with NotYetImplemented (Phase 2.6 stretch)", async function () {
      const { user, vault } = await deployStack();
      await expect(vault.connect(user).cancelDepositTimeout()).to.be.revertedWithCustomError(
        vault,
        "NotYetImplemented",
      );
    });
  });

  describe("view functions on empty state", function () {
    it("returns zero handles and zero createdAt for an unrecorded controller", async function () {
      const { user, vault } = await deployStack();
      expect(await vault.pendingDepositOf(user.address)).to.equal(ethers.ZeroHash);
      expect(await vault.claimableDepositOf(user.address)).to.equal(ethers.ZeroHash);
      expect(await vault.depositCreatedAt(user.address)).to.equal(0);
    });
  });
});
