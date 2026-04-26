const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockUSDC", function () {
  let usdc;
  let owner;
  let other;
  let recipient;

  beforeEach(async function () {
    [owner, other, recipient] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy(owner.address);
    await usdc.waitForDeployment();
  });

  it("reports six decimals to match real USDC", async function () {
    expect(await usdc.decimals()).to.equal(6);
  });

  it("uses Mock USDC and mUSDC for name and symbol", async function () {
    expect(await usdc.name()).to.equal("Mock USDC");
    expect(await usdc.symbol()).to.equal("mUSDC");
  });

  it("mints to the recipient when owner calls mint", async function () {
    const amount = 1_000_000_000n; // 1000 mUSDC at 6 decimals
    await usdc.connect(owner).mint(recipient.address, amount);
    expect(await usdc.balanceOf(recipient.address)).to.equal(amount);
    expect(await usdc.totalSupply()).to.equal(amount);
  });

  it("rejects mint from non-owner", async function () {
    await expect(usdc.connect(other).mint(recipient.address, 1)).to.be.revertedWithCustomError(
      usdc,
      "OwnableUnauthorizedAccount",
    );
  });

  it("supports standard ERC-20 transfer", async function () {
    await usdc.connect(owner).mint(other.address, 1_000_000n);
    await usdc.connect(other).transfer(recipient.address, 500_000n);
    expect(await usdc.balanceOf(other.address)).to.equal(500_000n);
    expect(await usdc.balanceOf(recipient.address)).to.equal(500_000n);
  });
});
