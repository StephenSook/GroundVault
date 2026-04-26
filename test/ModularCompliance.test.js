const { expect } = require("chai");
const { ethers } = require("hardhat");

async function deployStack() {
  const [owner, other, token, from, to] = await ethers.getSigners();

  const Compliance = await ethers.getContractFactory("ModularCompliance");
  const compliance = await Compliance.deploy(owner.address);
  await compliance.waitForDeployment();

  const MockModule = await ethers.getContractFactory("MockModule");
  const moduleA = await MockModule.deploy(true);
  await moduleA.waitForDeployment();
  const moduleB = await MockModule.deploy(true);
  await moduleB.waitForDeployment();

  return { owner, other, token, from, to, compliance, moduleA, moduleB };
}

describe("ModularCompliance", function () {
  describe("bindToken / unbindToken", function () {
    it("binds and unbinds the token", async function () {
      const { owner, token, compliance } = await deployStack();
      await compliance.connect(owner).bindToken(token.address);
      expect(await compliance.tokenBound()).to.equal(token.address);

      await compliance.connect(owner).unbindToken();
      expect(await compliance.tokenBound()).to.equal(ethers.ZeroAddress);
    });

    it("emits TokenBound and TokenUnbound", async function () {
      const { owner, token, compliance } = await deployStack();
      await expect(compliance.connect(owner).bindToken(token.address))
        .to.emit(compliance, "TokenBound")
        .withArgs(token.address);
      await expect(compliance.connect(owner).unbindToken())
        .to.emit(compliance, "TokenUnbound")
        .withArgs(token.address);
    });

    it("rejects zero-address token, double-bind, and unbind-when-empty", async function () {
      const { owner, token, compliance } = await deployStack();
      await expect(
        compliance.connect(owner).bindToken(ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(compliance, "ZeroAddressToken");

      await compliance.connect(owner).bindToken(token.address);
      await expect(
        compliance.connect(owner).bindToken(token.address),
      ).to.be.revertedWithCustomError(compliance, "TokenAlreadyBound");

      await compliance.connect(owner).unbindToken();
      await expect(compliance.connect(owner).unbindToken()).to.be.revertedWithCustomError(
        compliance,
        "TokenNotBound",
      );
    });

    it("rejects non-owner callers", async function () {
      const { other, token, compliance } = await deployStack();
      await expect(
        compliance.connect(other).bindToken(token.address),
      ).to.be.revertedWithCustomError(compliance, "OwnableUnauthorizedAccount");
    });
  });

  describe("addModule / removeModule", function () {
    it("registers a module and notifies the module via bindCompliance", async function () {
      const { owner, compliance, moduleA } = await deployStack();
      await compliance.connect(owner).addModule(await moduleA.getAddress());

      expect(await compliance.isModuleBound(await moduleA.getAddress())).to.equal(true);
      expect(await moduleA.isComplianceBound(await compliance.getAddress())).to.equal(true);
      expect(await compliance.getModules()).to.deep.equal([await moduleA.getAddress()]);
    });

    it("removes a module and notifies it via unbindCompliance", async function () {
      const { owner, compliance, moduleA, moduleB } = await deployStack();
      await compliance.connect(owner).addModule(await moduleA.getAddress());
      await compliance.connect(owner).addModule(await moduleB.getAddress());

      await compliance.connect(owner).removeModule(await moduleA.getAddress());

      expect(await compliance.isModuleBound(await moduleA.getAddress())).to.equal(false);
      expect(await moduleA.isComplianceBound(await compliance.getAddress())).to.equal(false);
      expect(await compliance.getModules()).to.deep.equal([await moduleB.getAddress()]);
    });

    it("rejects zero-address, duplicate, missing, and non-owner cases", async function () {
      const { owner, other, compliance, moduleA } = await deployStack();

      await expect(
        compliance.connect(owner).addModule(ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(compliance, "ZeroAddressModule");

      await compliance.connect(owner).addModule(await moduleA.getAddress());
      await expect(
        compliance.connect(owner).addModule(await moduleA.getAddress()),
      )
        .to.be.revertedWithCustomError(compliance, "ModuleAlreadyRegistered")
        .withArgs(await moduleA.getAddress());

      await expect(
        compliance.connect(other).addModule(await moduleA.getAddress()),
      ).to.be.revertedWithCustomError(compliance, "OwnableUnauthorizedAccount");

      const Mock = await ethers.getContractFactory("MockModule");
      const stranger = await Mock.deploy(true);
      await stranger.waitForDeployment();
      await expect(
        compliance.connect(owner).removeModule(await stranger.getAddress()),
      )
        .to.be.revertedWithCustomError(compliance, "ModuleNotRegistered")
        .withArgs(await stranger.getAddress());
    });
  });

  describe("canTransfer fan-out", function () {
    it("returns true when every module agrees", async function () {
      const { owner, from, to, compliance, moduleA, moduleB } = await deployStack();
      await compliance.connect(owner).addModule(await moduleA.getAddress());
      await compliance.connect(owner).addModule(await moduleB.getAddress());

      expect(await compliance.canTransfer(from.address, to.address, 0)).to.equal(true);
    });

    it("returns false if any module rejects", async function () {
      const { owner, from, to, compliance, moduleA, moduleB } = await deployStack();
      await compliance.connect(owner).addModule(await moduleA.getAddress());
      await compliance.connect(owner).addModule(await moduleB.getAddress());

      await moduleB.setAllowed(false);
      expect(await compliance.canTransfer(from.address, to.address, 0)).to.equal(false);
    });
  });

  describe("transferred / created / destroyed token-only hooks", function () {
    it("only the bound token can call them; calls fan out to every module", async function () {
      const { owner, other, token, from, to, compliance, moduleA, moduleB } = await deployStack();
      await compliance.connect(owner).bindToken(token.address);
      await compliance.connect(owner).addModule(await moduleA.getAddress());
      await compliance.connect(owner).addModule(await moduleB.getAddress());

      await expect(
        compliance.connect(other).transferred(from.address, to.address, 0),
      ).to.be.revertedWithCustomError(compliance, "CallerNotToken");

      await compliance.connect(token).transferred(from.address, to.address, 0);
      await compliance.connect(token).created(to.address, 0);
      await compliance.connect(token).destroyed(from.address, 0);

      expect(await moduleA.transferActionCount()).to.equal(1n);
      expect(await moduleA.mintActionCount()).to.equal(1n);
      expect(await moduleA.burnActionCount()).to.equal(1n);

      expect(await moduleB.transferActionCount()).to.equal(1n);
      expect(await moduleB.mintActionCount()).to.equal(1n);
      expect(await moduleB.burnActionCount()).to.equal(1n);
    });
  });
});
