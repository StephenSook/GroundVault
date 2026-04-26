const { expect } = require("chai");
const { ethers } = require("hardhat");

// Structural tests only — Nox precompile is not deployed on the local
// hardhat network, so the actual encrypted-balance transitions
// (wrap, confidentialTransfer, mint/burn loops) cannot be exercised
// here. Real behaviour is verified in Phase 3 integration tests on
// Arbitrum Sepolia. These tests cover the surfaces that run BEFORE
// any Nox.* call: constructor wiring, view functions, and the early
// revert paths.

describe("cUSDC (structural)", function () {
  let cusdc;
  let usdc;
  let owner;
  let user;
  let recipient;

  beforeEach(async function () {
    [owner, user, recipient] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy(owner.address);
    await usdc.waitForDeployment();

    const Cusdc = await ethers.getContractFactory("cUSDC");
    cusdc = await Cusdc.deploy(await usdc.getAddress());
    await cusdc.waitForDeployment();
  });

  describe("constructor", function () {
    it("stores the underlying token", async function () {
      expect(await cusdc.underlying()).to.equal(await usdc.getAddress());
    });

    it("reverts on zero-address underlying", async function () {
      const Cusdc = await ethers.getContractFactory("cUSDC");
      await expect(Cusdc.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        Cusdc,
        "ZeroAddressUnderlying",
      );
    });
  });

  describe("view functions before any wrap", function () {
    it("returns the zero handle for an unset balance", async function () {
      expect(await cusdc.confidentialBalanceOf(user.address)).to.equal(ethers.ZeroHash);
    });

    it("returns the zero handle for total supply", async function () {
      expect(await cusdc.confidentialTotalSupply()).to.equal(ethers.ZeroHash);
    });
  });

  describe("wrap pre-Nox revert paths", function () {
    it("reverts on zero amount before touching Nox", async function () {
      await expect(cusdc.connect(user).wrap(0)).to.be.revertedWithCustomError(
        cusdc,
        "ZeroAmount",
      );
    });
  });

  describe("confidentialTransfer pre-Nox revert paths", function () {
    // Use a syntactically valid externalEuint256 placeholder. Nox is
    // never reached because the address checks short-circuit first.
    const placeholderHandle = ethers.ZeroHash;
    const placeholderProof = "0x";

    it("reverts when transferring to the zero address", async function () {
      await expect(
        cusdc.connect(user).confidentialTransfer(ethers.ZeroAddress, placeholderHandle, placeholderProof),
      ).to.be.revertedWithCustomError(cusdc, "TransferToZero");
    });

    it("reverts when transferring to self", async function () {
      await expect(
        cusdc.connect(user).confidentialTransfer(user.address, placeholderHandle, placeholderProof),
      ).to.be.revertedWithCustomError(cusdc, "TransferToSelf");
    });
  });
});
