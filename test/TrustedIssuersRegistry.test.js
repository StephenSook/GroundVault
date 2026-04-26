const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TrustedIssuersRegistry", function () {
  let registry;
  let owner;
  let other;
  let issuerA;
  let issuerB;
  let issuerC;

  beforeEach(async function () {
    [owner, other, issuerA, issuerB, issuerC] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("TrustedIssuersRegistry");
    registry = await Registry.deploy(owner.address);
    await registry.waitForDeployment();
  });

  describe("addTrustedIssuer", function () {
    it("registers an issuer for one or more topics", async function () {
      await registry.addTrustedIssuer(issuerA.address, [1, 7]);

      expect(await registry.isTrustedIssuer(issuerA.address)).to.equal(true);
      expect(await registry.hasClaimTopic(issuerA.address, 1)).to.equal(true);
      expect(await registry.hasClaimTopic(issuerA.address, 7)).to.equal(true);
      expect(await registry.hasClaimTopic(issuerA.address, 99)).to.equal(false);
      expect(await registry.getTrustedIssuerClaimTopics(issuerA.address)).to.deep.equal([1n, 7n]);
    });

    it("populates the reverse topic -> issuers index", async function () {
      await registry.addTrustedIssuer(issuerA.address, [1]);
      await registry.addTrustedIssuer(issuerB.address, [1, 7]);

      expect(await registry.getTrustedIssuersForClaimTopic(1)).to.deep.equal([
        issuerA.address,
        issuerB.address,
      ]);
      expect(await registry.getTrustedIssuersForClaimTopic(7)).to.deep.equal([issuerB.address]);
    });

    it("emits TrustedIssuerAdded with the topics array", async function () {
      await expect(registry.addTrustedIssuer(issuerA.address, [1, 7]))
        .to.emit(registry, "TrustedIssuerAdded")
        .withArgs(issuerA.address, [1n, 7n]);
    });

    it("reverts on zero address issuer", async function () {
      await expect(registry.addTrustedIssuer(ethers.ZeroAddress, [1])).to.be.revertedWithCustomError(
        registry,
        "ZeroAddressIssuer",
      );
    });

    it("reverts on empty topics array", async function () {
      await expect(registry.addTrustedIssuer(issuerA.address, [])).to.be.revertedWithCustomError(
        registry,
        "EmptyClaimTopics",
      );
    });

    it("reverts when re-adding an already-registered issuer", async function () {
      await registry.addTrustedIssuer(issuerA.address, [1]);
      await expect(registry.addTrustedIssuer(issuerA.address, [7]))
        .to.be.revertedWithCustomError(registry, "IssuerAlreadyRegistered")
        .withArgs(issuerA.address);
    });

    it("reverts when called by a non-owner", async function () {
      await expect(
        registry.connect(other).addTrustedIssuer(issuerA.address, [1]),
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  describe("removeTrustedIssuer", function () {
    beforeEach(async function () {
      await registry.addTrustedIssuer(issuerA.address, [1, 7]);
      await registry.addTrustedIssuer(issuerB.address, [1, 7, 9]);
      await registry.addTrustedIssuer(issuerC.address, [9]);
    });

    it("clears forward and reverse indexes", async function () {
      await registry.removeTrustedIssuer(issuerB.address);

      expect(await registry.isTrustedIssuer(issuerB.address)).to.equal(false);
      expect(await registry.hasClaimTopic(issuerB.address, 1)).to.equal(false);
      expect(await registry.getTrustedIssuersForClaimTopic(1)).to.deep.equal([issuerA.address]);
      expect(await registry.getTrustedIssuersForClaimTopic(7)).to.deep.equal([issuerA.address]);
      expect(await registry.getTrustedIssuersForClaimTopic(9)).to.deep.equal([issuerC.address]);
    });

    it("emits TrustedIssuerRemoved", async function () {
      await expect(registry.removeTrustedIssuer(issuerA.address))
        .to.emit(registry, "TrustedIssuerRemoved")
        .withArgs(issuerA.address);
    });

    it("reverts when removing an unregistered issuer", async function () {
      await expect(registry.removeTrustedIssuer(other.address))
        .to.be.revertedWithCustomError(registry, "IssuerNotRegistered")
        .withArgs(other.address);
    });

    it("permits re-registering a previously removed issuer", async function () {
      await registry.removeTrustedIssuer(issuerA.address);
      await registry.addTrustedIssuer(issuerA.address, [9]);
      expect(await registry.hasClaimTopic(issuerA.address, 9)).to.equal(true);
      expect(await registry.hasClaimTopic(issuerA.address, 1)).to.equal(false);
    });
  });

  describe("updateIssuerClaimTopics", function () {
    beforeEach(async function () {
      await registry.addTrustedIssuer(issuerA.address, [1, 7]);
    });

    it("replaces the topics list", async function () {
      await registry.updateIssuerClaimTopics(issuerA.address, [9]);

      expect(await registry.getTrustedIssuerClaimTopics(issuerA.address)).to.deep.equal([9n]);
      expect(await registry.hasClaimTopic(issuerA.address, 1)).to.equal(false);
      expect(await registry.hasClaimTopic(issuerA.address, 7)).to.equal(false);
      expect(await registry.hasClaimTopic(issuerA.address, 9)).to.equal(true);
    });

    it("rebuilds the reverse index correctly", async function () {
      await registry.updateIssuerClaimTopics(issuerA.address, [9]);

      expect(await registry.getTrustedIssuersForClaimTopic(1)).to.deep.equal([]);
      expect(await registry.getTrustedIssuersForClaimTopic(7)).to.deep.equal([]);
      expect(await registry.getTrustedIssuersForClaimTopic(9)).to.deep.equal([issuerA.address]);
    });

    it("emits ClaimTopicsUpdated", async function () {
      await expect(registry.updateIssuerClaimTopics(issuerA.address, [9]))
        .to.emit(registry, "ClaimTopicsUpdated")
        .withArgs(issuerA.address, [9n]);
    });

    it("reverts when updating an unregistered issuer", async function () {
      await expect(
        registry.updateIssuerClaimTopics(other.address, [9]),
      ).to.be.revertedWithCustomError(registry, "IssuerNotRegistered");
    });

    it("reverts on empty topics array", async function () {
      await expect(
        registry.updateIssuerClaimTopics(issuerA.address, []),
      ).to.be.revertedWithCustomError(registry, "EmptyClaimTopics");
    });
  });
});
