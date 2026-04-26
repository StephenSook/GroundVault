const { expect } = require("chai");
const { ethers } = require("hardhat");

const TIMEOUT = 24 * 60 * 60;

async function deployStack() {
  const [admin, user] = await ethers.getSigners();

  const ClaimTopics = await ethers.getContractFactory("ClaimTopicsRegistry");
  const claimTopics = await ClaimTopics.deploy(admin.address);
  await claimTopics.waitForDeployment();

  const TrustedIssuers = await ethers.getContractFactory("TrustedIssuersRegistry");
  const trustedIssuers = await TrustedIssuers.deploy(admin.address);
  await trustedIssuers.waitForDeployment();

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

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy(admin.address);
  await usdc.waitForDeployment();

  const Cusdc = await ethers.getContractFactory("cUSDC");
  const cusdc = await Cusdc.deploy(await usdc.getAddress());
  await cusdc.waitForDeployment();

  const Token = await ethers.getContractFactory("GroundVaultToken");
  const shareToken = await Token.deploy(
    admin.address,
    await identityRegistry.getAddress(),
    await compliance.getAddress(),
  );
  await shareToken.waitForDeployment();
  await compliance.connect(admin).bindToken(await shareToken.getAddress());

  const Vault = await ethers.getContractFactory("GroundVaultCore");
  const vault = await Vault.deploy(
    admin.address,
    await identityRegistry.getAddress(),
    await shareToken.getAddress(),
    await cusdc.getAddress(),
    TIMEOUT,
  );
  await vault.waitForDeployment();

  const Router = await ethers.getContractFactory("GroundVaultRouter");
  const router = await Router.deploy(await shareToken.getAddress(), await vault.getAddress());
  await router.waitForDeployment();

  return { admin, user, shareToken, vault, router };
}

describe("GroundVaultRouter", function () {
  describe("constructor", function () {
    it("rejects zero-address inputs", async function () {
      const { vault, shareToken } = await deployStack();
      const Router = await ethers.getContractFactory("GroundVaultRouter");

      await expect(
        Router.deploy(ethers.ZeroAddress, await vault.getAddress()),
      ).to.be.revertedWithCustomError(Router, "ZeroAddressShareToken");

      await expect(
        Router.deploy(await shareToken.getAddress(), ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(Router, "ZeroAddressVault");
    });

    it("stores the share token and vault pointers", async function () {
      const { router, shareToken, vault } = await deployStack();
      expect(await router.shareToken()).to.equal(await shareToken.getAddress());
      expect(await router.vault()).to.equal(await vault.getAddress());
    });
  });

  describe("encrypted handle pass-through", function () {
    it("returns zero handles for an empty vault", async function () {
      const { router, user } = await deployStack();
      expect(await router.aggregateVaultSupply()).to.equal(ethers.ZeroHash);
      expect(await router.holderBalance(user.address)).to.equal(ethers.ZeroHash);
      expect(await router.pendingDepositOf(user.address)).to.equal(ethers.ZeroHash);
      expect(await router.claimableDepositOf(user.address)).to.equal(ethers.ZeroHash);
    });

    it("returns the same handle the underlying contracts expose", async function () {
      const { router, user, shareToken, vault } = await deployStack();
      expect(await router.aggregateVaultSupply()).to.equal(
        await shareToken.confidentialTotalSupply(),
      );
      expect(await router.holderBalance(user.address)).to.equal(
        await shareToken.confidentialBalanceOf(user.address),
      );
      expect(await router.pendingDepositOf(user.address)).to.equal(
        await vault.pendingDepositOf(user.address),
      );
      expect(await router.claimableDepositOf(user.address)).to.equal(
        await vault.claimableDepositOf(user.address),
      );
    });
  });

  describe("public scalars", function () {
    it("forwards depositCreatedAt as a plain timestamp", async function () {
      const { router, user, vault } = await deployStack();
      expect(await router.depositCreatedAt(user.address)).to.equal(
        await vault.depositCreatedAt(user.address),
      );
    });
  });
});
