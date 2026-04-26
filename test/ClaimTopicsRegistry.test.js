const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ClaimTopicsRegistry", function () {
  let registry;
  let owner;
  let other;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("ClaimTopicsRegistry");
    registry = await Registry.deploy(owner.address);
    await registry.waitForDeployment();
  });

  describe("addClaimTopic", function () {
    it("appends topics in registration order", async function () {
      await registry.addClaimTopic(1);
      await registry.addClaimTopic(7);
      await registry.addClaimTopic(9);

      expect(await registry.getClaimTopics()).to.deep.equal([1n, 7n, 9n]);
    });

    it("emits ClaimTopicAdded", async function () {
      await expect(registry.addClaimTopic(1))
        .to.emit(registry, "ClaimTopicAdded")
        .withArgs(1n);
    });

    it("reverts when adding a duplicate", async function () {
      await registry.addClaimTopic(1);
      await expect(registry.addClaimTopic(1))
        .to.be.revertedWithCustomError(registry, "ClaimTopicAlreadyExists")
        .withArgs(1n);
    });

    it("reverts when called by a non-owner", async function () {
      await expect(registry.connect(other).addClaimTopic(1))
        .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount")
        .withArgs(other.address);
    });
  });

  describe("removeClaimTopic", function () {
    beforeEach(async function () {
      await registry.addClaimTopic(1);
      await registry.addClaimTopic(7);
      await registry.addClaimTopic(9);
    });

    it("removes the only matching entry and preserves remaining order via swap-and-pop", async function () {
      await registry.removeClaimTopic(7);
      const remaining = await registry.getClaimTopics();
      expect(remaining).to.have.lengthOf(2);
      expect(remaining).to.include(1n);
      expect(remaining).to.include(9n);
    });

    it("permits re-adding a removed topic", async function () {
      await registry.removeClaimTopic(7);
      await registry.addClaimTopic(7);
      expect((await registry.getClaimTopics()).length).to.equal(3);
    });

    it("removes the trailing entry without index swap", async function () {
      await registry.removeClaimTopic(9);
      expect(await registry.getClaimTopics()).to.deep.equal([1n, 7n]);
    });

    it("emits ClaimTopicRemoved", async function () {
      await expect(registry.removeClaimTopic(1))
        .to.emit(registry, "ClaimTopicRemoved")
        .withArgs(1n);
    });

    it("reverts when removing a non-existent topic", async function () {
      await expect(registry.removeClaimTopic(42))
        .to.be.revertedWithCustomError(registry, "ClaimTopicNotFound")
        .withArgs(42n);
    });

    it("reverts when called by a non-owner", async function () {
      await expect(registry.connect(other).removeClaimTopic(1))
        .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount")
        .withArgs(other.address);
    });
  });

  describe("ownership", function () {
    it("uses Ownable2Step transfer flow", async function () {
      await registry.transferOwnership(other.address);
      expect(await registry.owner()).to.equal(owner.address);
      await registry.connect(other).acceptOwnership();
      expect(await registry.owner()).to.equal(other.address);
    });
  });
});
