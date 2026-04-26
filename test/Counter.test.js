const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Counter", function () {
  it("starts at zero and increments", async function () {
    const Counter = await ethers.getContractFactory("Counter");
    const counter = await Counter.deploy();
    await counter.waitForDeployment();

    expect(await counter.count()).to.equal(0n);

    await counter.increment();
    expect(await counter.count()).to.equal(1n);

    await counter.increment();
    expect(await counter.count()).to.equal(2n);
  });

  it("emits Incremented with the new count", async function () {
    const Counter = await ethers.getContractFactory("Counter");
    const counter = await Counter.deploy();
    await counter.waitForDeployment();

    await expect(counter.increment())
      .to.emit(counter, "Incremented")
      .withArgs(1n);
  });
});
