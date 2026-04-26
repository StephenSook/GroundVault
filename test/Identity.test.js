const { expect } = require("chai");
const { ethers } = require("hardhat");

const TOPIC_KYC = 1n;
const TOPIC_ACCREDITATION = 7n;
const SCHEME_ECDSA = 1n;

function claimIdFor(issuer, topic) {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [issuer, topic]),
  );
}

describe("Identity", function () {
  let identity;
  let owner;
  let other;
  let issuerA;
  let issuerB;

  beforeEach(async function () {
    [owner, other, issuerA, issuerB] = await ethers.getSigners();
    const Identity = await ethers.getContractFactory("Identity");
    identity = await Identity.deploy(owner.address);
    await identity.waitForDeployment();
  });

  describe("constructor", function () {
    it("sets the owner", async function () {
      expect(await identity.owner()).to.equal(owner.address);
    });
  });

  describe("addClaim", function () {
    const data = ethers.toUtf8Bytes("kyc-ref-001");
    const sig = "0x1234";
    const uri = "ipfs://QmExample";

    it("stores a new claim and returns the deterministic id", async function () {
      const expected = claimIdFor(issuerA.address, TOPIC_KYC);

      const tx = await identity.addClaim(TOPIC_KYC, SCHEME_ECDSA, issuerA.address, sig, data, uri);
      await tx.wait();

      const stored = await identity.getClaim(expected);
      expect(stored.topic).to.equal(TOPIC_KYC);
      expect(stored.scheme).to.equal(SCHEME_ECDSA);
      expect(stored.issuer).to.equal(issuerA.address);
      expect(stored.signature).to.equal(sig);
      expect(stored.data).to.equal(ethers.hexlify(data));
      expect(stored.uri).to.equal(uri);
    });

    it("indexes the claimId under its topic", async function () {
      await identity.addClaim(TOPIC_KYC, SCHEME_ECDSA, issuerA.address, sig, data, uri);
      const ids = await identity.getClaimIdsByTopic(TOPIC_KYC);
      expect(ids).to.deep.equal([claimIdFor(issuerA.address, TOPIC_KYC)]);
    });

    it("emits ClaimAdded with the full payload", async function () {
      const id = claimIdFor(issuerA.address, TOPIC_KYC);
      await expect(
        identity.addClaim(TOPIC_KYC, SCHEME_ECDSA, issuerA.address, sig, data, uri),
      )
        .to.emit(identity, "ClaimAdded")
        .withArgs(id, TOPIC_KYC, issuerA.address, sig, ethers.hexlify(data), uri);
    });

    it("replaces an existing (issuer, topic) without duplicating index", async function () {
      await identity.addClaim(TOPIC_KYC, SCHEME_ECDSA, issuerA.address, "0xaa", data, "ipfs://v1");
      await identity.addClaim(TOPIC_KYC, SCHEME_ECDSA, issuerA.address, "0xbb", data, "ipfs://v2");

      const ids = await identity.getClaimIdsByTopic(TOPIC_KYC);
      expect(ids).to.have.lengthOf(1);

      const stored = await identity.getClaim(claimIdFor(issuerA.address, TOPIC_KYC));
      expect(stored.signature).to.equal("0xbb");
      expect(stored.uri).to.equal("ipfs://v2");
    });

    it("supports multiple issuers per topic", async function () {
      await identity.addClaim(TOPIC_KYC, SCHEME_ECDSA, issuerA.address, sig, data, uri);
      await identity.addClaim(TOPIC_KYC, SCHEME_ECDSA, issuerB.address, sig, data, uri);

      const ids = await identity.getClaimIdsByTopic(TOPIC_KYC);
      expect(ids).to.have.lengthOf(2);
      expect(ids).to.include(claimIdFor(issuerA.address, TOPIC_KYC));
      expect(ids).to.include(claimIdFor(issuerB.address, TOPIC_KYC));
    });

    it("reverts on zero-address issuer", async function () {
      await expect(
        identity.addClaim(TOPIC_KYC, SCHEME_ECDSA, ethers.ZeroAddress, sig, data, uri),
      ).to.be.revertedWithCustomError(identity, "ZeroAddressIssuer");
    });

    it("reverts when called by non-owner", async function () {
      await expect(
        identity.connect(other).addClaim(TOPIC_KYC, SCHEME_ECDSA, issuerA.address, sig, data, uri),
      ).to.be.revertedWithCustomError(identity, "OwnableUnauthorizedAccount");
    });
  });

  describe("removeClaim", function () {
    const data = ethers.toUtf8Bytes("kyc-ref-001");
    const sig = "0x1234";

    beforeEach(async function () {
      await identity.addClaim(TOPIC_KYC, SCHEME_ECDSA, issuerA.address, sig, data, "");
      await identity.addClaim(TOPIC_KYC, SCHEME_ECDSA, issuerB.address, sig, data, "");
      await identity.addClaim(TOPIC_ACCREDITATION, SCHEME_ECDSA, issuerA.address, sig, data, "");
    });

    it("clears the claim record and the topic index entry", async function () {
      const id = claimIdFor(issuerA.address, TOPIC_KYC);
      await identity.removeClaim(id);

      const cleared = await identity.getClaim(id);
      expect(cleared.issuer).to.equal(ethers.ZeroAddress);

      const ids = await identity.getClaimIdsByTopic(TOPIC_KYC);
      expect(ids).to.have.lengthOf(1);
      expect(ids[0]).to.equal(claimIdFor(issuerB.address, TOPIC_KYC));
    });

    it("removes the trailing entry without index swap", async function () {
      const id = claimIdFor(issuerB.address, TOPIC_KYC);
      await identity.removeClaim(id);

      const ids = await identity.getClaimIdsByTopic(TOPIC_KYC);
      expect(ids).to.deep.equal([claimIdFor(issuerA.address, TOPIC_KYC)]);
    });

    it("emits ClaimRemoved with topic and issuer", async function () {
      const id = claimIdFor(issuerA.address, TOPIC_KYC);
      await expect(identity.removeClaim(id))
        .to.emit(identity, "ClaimRemoved")
        .withArgs(id, TOPIC_KYC, issuerA.address);
    });

    it("permits re-adding a previously removed claim", async function () {
      const id = claimIdFor(issuerA.address, TOPIC_KYC);
      await identity.removeClaim(id);
      await identity.addClaim(TOPIC_KYC, SCHEME_ECDSA, issuerA.address, "0xcafebabe", data, "");

      const stored = await identity.getClaim(id);
      expect(stored.signature).to.equal("0xcafebabe");

      const ids = await identity.getClaimIdsByTopic(TOPIC_KYC);
      expect(ids).to.have.lengthOf(2);
    });

    it("reverts on unknown claim id", async function () {
      const ghost = ethers.id("does-not-exist");
      await expect(identity.removeClaim(ghost))
        .to.be.revertedWithCustomError(identity, "ClaimNotFound")
        .withArgs(ghost);
    });

    it("reverts when called by non-owner", async function () {
      const id = claimIdFor(issuerA.address, TOPIC_KYC);
      await expect(identity.connect(other).removeClaim(id)).to.be.revertedWithCustomError(
        identity,
        "OwnableUnauthorizedAccount",
      );
    });
  });
});
