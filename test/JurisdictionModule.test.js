const { expect } = require("chai");
const { ethers } = require("hardhat");

const COUNTRY_US = 840;
const COUNTRY_CA = 124;
const COUNTRY_RU = 643;

async function deployStack() {
  const [admin, agent, compliance, user, otherUser] = await ethers.getSigners();

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
  const otherIdentity = await Identity.deploy(otherUser.address);
  await otherIdentity.waitForDeployment();

  await registry
    .connect(agent)
    .registerIdentity(user.address, await userIdentity.getAddress(), COUNTRY_US);
  await registry
    .connect(agent)
    .registerIdentity(otherUser.address, await otherIdentity.getAddress(), COUNTRY_RU);

  const Module = await ethers.getContractFactory("JurisdictionModule");
  const module = await Module.deploy(admin.address, await registry.getAddress());
  await module.waitForDeployment();

  return { admin, compliance, user, otherUser, registry, module };
}

describe("JurisdictionModule", function () {
  describe("constructor", function () {
    it("rejects zero-address IdentityRegistry", async function () {
      const [admin] = await ethers.getSigners();
      const Module = await ethers.getContractFactory("JurisdictionModule");
      await expect(Module.deploy(admin.address, ethers.ZeroAddress)).to.be.revertedWithCustomError(
        Module,
        "ZeroAddressIdentityRegistry",
      );
    });

    it("emits IdentityRegistrySet on deploy", async function () {
      const [admin] = await ethers.getSigners();
      const ClaimTopics = await ethers.getContractFactory("ClaimTopicsRegistry");
      const ct = await ClaimTopics.deploy(admin.address);
      await ct.waitForDeployment();
      const Trusted = await ethers.getContractFactory("TrustedIssuersRegistry");
      const ti = await Trusted.deploy(admin.address);
      await ti.waitForDeployment();
      const Registry = await ethers.getContractFactory("IdentityRegistry");
      const reg = await Registry.deploy(
        admin.address,
        await ct.getAddress(),
        await ti.getAddress(),
      );
      await reg.waitForDeployment();
      const Module = await ethers.getContractFactory("JurisdictionModule");
      const tx = Module.deploy(admin.address, await reg.getAddress());
      const deployed = await tx;
      const receipt = await deployed.deploymentTransaction().wait();
      const events = receipt.logs.map((l) => {
        try {
          return deployed.interface.parseLog(l);
        } catch {
          return null;
        }
      });
      expect(events.filter((e) => e !== null).map((e) => e.name)).to.include(
        "IdentityRegistrySet",
      );
    });
  });

  describe("addAllowedCountry / removeAllowedCountry", function () {
    it("adds and removes countries with O(1) swap-and-pop semantics", async function () {
      const { admin, module } = await deployStack();
      await module.connect(admin).addAllowedCountry(COUNTRY_US);
      await module.connect(admin).addAllowedCountry(COUNTRY_CA);

      expect(await module.isCountryAllowed(COUNTRY_US)).to.equal(true);
      expect(await module.isCountryAllowed(COUNTRY_CA)).to.equal(true);
      expect(await module.getAllowedCountries()).to.deep.equal([COUNTRY_US, COUNTRY_CA]);

      await module.connect(admin).removeAllowedCountry(COUNTRY_US);

      expect(await module.isCountryAllowed(COUNTRY_US)).to.equal(false);
      expect(await module.isCountryAllowed(COUNTRY_CA)).to.equal(true);
      expect(await module.getAllowedCountries()).to.deep.equal([COUNTRY_CA]);
    });

    it("emits AllowedCountryAdded and AllowedCountryRemoved", async function () {
      const { admin, module } = await deployStack();
      await expect(module.connect(admin).addAllowedCountry(COUNTRY_US))
        .to.emit(module, "AllowedCountryAdded")
        .withArgs(COUNTRY_US);
      await expect(module.connect(admin).removeAllowedCountry(COUNTRY_US))
        .to.emit(module, "AllowedCountryRemoved")
        .withArgs(COUNTRY_US);
    });

    it("reverts on duplicate add and missing remove", async function () {
      const { admin, module } = await deployStack();
      await module.connect(admin).addAllowedCountry(COUNTRY_US);
      await expect(module.connect(admin).addAllowedCountry(COUNTRY_US))
        .to.be.revertedWithCustomError(module, "CountryAlreadyAllowed")
        .withArgs(COUNTRY_US);

      await expect(module.connect(admin).removeAllowedCountry(COUNTRY_CA))
        .to.be.revertedWithCustomError(module, "CountryNotAllowed")
        .withArgs(COUNTRY_CA);
    });
  });

  describe("bindCompliance / unbindCompliance", function () {
    it("rejects callers that are not the bound compliance", async function () {
      const { compliance: pretender, module } = await deployStack();

      const fakeCompliance = pretender.address; // any address that is not msg.sender
      // The pretender signer's address differs from the EOA the test passes in.
      // bindCompliance must revert because msg.sender (the test default signer)
      // is not equal to the `compliance` argument.
      await expect(
        module.bindCompliance(fakeCompliance),
      )
        .to.be.revertedWithCustomError(module, "UnauthorizedComplianceBinding");

      await expect(
        module.unbindCompliance(fakeCompliance),
      )
        .to.be.revertedWithCustomError(module, "UnauthorizedComplianceBinding");
    });

    it("accepts a self-binding caller (the standard ModularCompliance.addModule path)", async function () {
      const { module, admin } = await deployStack();
      // When the caller IS the compliance argument, the check passes.
      await module.connect(admin).bindCompliance(admin.address);
      expect(await module.isComplianceBound(admin.address)).to.equal(true);

      await module.connect(admin).unbindCompliance(admin.address);
      expect(await module.isComplianceBound(admin.address)).to.equal(false);
    });

    it("integrates correctly with ModularCompliance.addModule", async function () {
      const { admin, module } = await deployStack();
      const Compliance = await ethers.getContractFactory("ModularCompliance");
      const compliance = await Compliance.deploy(admin.address);
      await compliance.waitForDeployment();

      // ModularCompliance.addModule calls module.bindCompliance(address(this))
      // — msg.sender (the compliance contract) equals the `compliance`
      // argument, so the new gate is satisfied.
      await compliance.connect(admin).addModule(await module.getAddress());
      expect(await module.isComplianceBound(await compliance.getAddress())).to.equal(true);

      await compliance.connect(admin).removeModule(await module.getAddress());
      expect(await module.isComplianceBound(await compliance.getAddress())).to.equal(false);
    });

    it("treats a mint (from == address(0)) as a regular transfer — recipient is checked", async function () {
      const { admin, compliance, user, otherUser, module } = await deployStack();
      await module.connect(admin).addAllowedCountry(COUNTRY_US);

      // Allowed recipient: user is registered with COUNTRY_US
      expect(
        await module.moduleCheck(ethers.ZeroAddress, user.address, 0, compliance.address),
      ).to.equal(true);

      // Disallowed recipient: otherUser is registered with COUNTRY_RU (not on the allowlist)
      expect(
        await module.moduleCheck(ethers.ZeroAddress, otherUser.address, 0, compliance.address),
      ).to.equal(false);
    });
  });

  describe("setIdentityRegistry", function () {
    it("owner can swap the IR; non-owner cannot", async function () {
      const { admin, module } = await deployStack();
      const [_, , , , , other] = await ethers.getSigners();

      const ClaimTopics = await ethers.getContractFactory("ClaimTopicsRegistry");
      const ct = await ClaimTopics.deploy(admin.address);
      await ct.waitForDeployment();
      const Trusted = await ethers.getContractFactory("TrustedIssuersRegistry");
      const ti = await Trusted.deploy(admin.address);
      await ti.waitForDeployment();
      const Registry = await ethers.getContractFactory("IdentityRegistry");
      const replacement = await Registry.deploy(
        admin.address,
        await ct.getAddress(),
        await ti.getAddress(),
      );
      await replacement.waitForDeployment();

      await module.connect(admin).setIdentityRegistry(await replacement.getAddress());
      expect(await module.identityRegistry()).to.equal(await replacement.getAddress());

      await expect(
        module.connect(other).setIdentityRegistry(await replacement.getAddress()),
      ).to.be.revertedWithCustomError(module, "OwnableUnauthorizedAccount");
    });

    it("rejects zero-address replacement", async function () {
      const { admin, module } = await deployStack();
      await expect(
        module.connect(admin).setIdentityRegistry(ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(module, "ZeroAddressIdentityRegistry");
    });
  });

  describe("moduleCheck", function () {
    it("allows transfer when recipient's country is on the allowlist", async function () {
      const { admin, compliance, user, module } = await deployStack();
      await module.connect(admin).addAllowedCountry(COUNTRY_US);

      // Note: this contract treats `from`, `amount`, and `compliance` as
      // unused for jurisdiction enforcement. The recipient is what matters.
      expect(await module.moduleCheck(ethers.ZeroAddress, user.address, 0, compliance.address)).to.equal(
        true,
      );
    });

    it("rejects transfer when recipient's country is not on the allowlist", async function () {
      const { admin, compliance, otherUser, module } = await deployStack();
      await module.connect(admin).addAllowedCountry(COUNTRY_US);

      expect(
        await module.moduleCheck(ethers.ZeroAddress, otherUser.address, 0, compliance.address),
      ).to.equal(false);
    });

    it("treats to == zero as a burn and short-circuits to true", async function () {
      const { compliance, user, module } = await deployStack();
      // No allowed countries configured at all.
      expect(
        await module.moduleCheck(user.address, ethers.ZeroAddress, 0, compliance.address),
      ).to.equal(true);
    });
  });

  describe("name", function () {
    it("reports a stable identifier", async function () {
      const { module } = await deployStack();
      expect(await module.name()).to.equal("JurisdictionModule");
    });
  });
});
