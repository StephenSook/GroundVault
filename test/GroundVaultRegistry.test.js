const { expect } = require("chai");
const { ethers } = require("hardhat");

const STATUS_AVAILABLE = 0;
const STATUS_UNDER_CONTRACT = 1;

const ANCHOR = {
  addressLine: "960 Lawton St SW, Atlanta, GA",
  neighborhood: "Oakland City",
  operatorName: "Atlanta Land Trust",
  amiTier: 80,
  listPrice: 25_000_000n, // $250,000 in cents
  memoUri: "ipfs://QmExampleMemo",
};

describe("GroundVaultRegistry", function () {
  let registry;
  let admin;
  let memoBot;
  let other;

  beforeEach(async function () {
    [admin, memoBot, other] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("GroundVaultRegistry");
    registry = await Registry.deploy(admin.address);
    await registry.waitForDeployment();
    await registry.connect(admin).grantRole(await registry.MEMO_ROLE(), memoBot.address);
  });

  describe("addOpportunity", function () {
    it("assigns sequential ids starting at 1", async function () {
      await registry
        .connect(admin)
        .addOpportunity(
          ANCHOR.addressLine,
          ANCHOR.neighborhood,
          ANCHOR.operatorName,
          ANCHOR.amiTier,
          ANCHOR.listPrice,
          STATUS_AVAILABLE,
          ethers.id("memo-v1"),
          ANCHOR.memoUri,
        );

      expect(await registry.nextId()).to.equal(2);
      expect(await registry.exists(1)).to.equal(true);

      const op = await registry.getOpportunity(1);
      expect(op.addressLine).to.equal(ANCHOR.addressLine);
      expect(op.neighborhood).to.equal(ANCHOR.neighborhood);
      expect(op.operatorName).to.equal(ANCHOR.operatorName);
      expect(op.amiTier).to.equal(ANCHOR.amiTier);
      expect(op.listPrice).to.equal(ANCHOR.listPrice);
      expect(op.status).to.equal(STATUS_AVAILABLE);
      expect(op.memoUri).to.equal(ANCHOR.memoUri);
      expect(op.createdAt).to.be.greaterThan(0n);
    });

    it("emits OpportunityAdded with id, address, ami tier", async function () {
      await expect(
        registry
          .connect(admin)
          .addOpportunity(
            ANCHOR.addressLine,
            ANCHOR.neighborhood,
            ANCHOR.operatorName,
            ANCHOR.amiTier,
            ANCHOR.listPrice,
            STATUS_AVAILABLE,
            ethers.ZeroHash,
            "",
          ),
      )
        .to.emit(registry, "OpportunityAdded")
        .withArgs(1, ANCHOR.addressLine, ANCHOR.amiTier);
    });

    it("rejects empty address line", async function () {
      await expect(
        registry
          .connect(admin)
          .addOpportunity(
            "",
            ANCHOR.neighborhood,
            ANCHOR.operatorName,
            ANCHOR.amiTier,
            ANCHOR.listPrice,
            STATUS_AVAILABLE,
            ethers.ZeroHash,
            "",
          ),
      ).to.be.revertedWithCustomError(registry, "EmptyAddressLine");
    });

    it("rejects callers without DEFAULT_ADMIN_ROLE", async function () {
      await expect(
        registry
          .connect(other)
          .addOpportunity(
            ANCHOR.addressLine,
            ANCHOR.neighborhood,
            ANCHOR.operatorName,
            ANCHOR.amiTier,
            ANCHOR.listPrice,
            STATUS_AVAILABLE,
            ethers.ZeroHash,
            "",
          ),
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });
  });

  describe("updateOpportunity / setStatus", function () {
    beforeEach(async function () {
      await registry
        .connect(admin)
        .addOpportunity(
          ANCHOR.addressLine,
          ANCHOR.neighborhood,
          ANCHOR.operatorName,
          ANCHOR.amiTier,
          ANCHOR.listPrice,
          STATUS_AVAILABLE,
          ethers.id("memo-v1"),
          ANCHOR.memoUri,
        );
    });

    it("updates mutable fields and bumps updatedAt", async function () {
      const before = (await registry.getOpportunity(1)).updatedAt;
      // ensure block timestamp advances
      await ethers.provider.send("evm_increaseTime", [10]);
      await ethers.provider.send("evm_mine", []);

      await registry.connect(admin).updateOpportunity(1, "Pittsburgh", "ALT", 60, 20_000_000n);
      const after = await registry.getOpportunity(1);

      expect(after.neighborhood).to.equal("Pittsburgh");
      expect(after.operatorName).to.equal("ALT");
      expect(after.amiTier).to.equal(60);
      expect(after.listPrice).to.equal(20_000_000n);
      expect(after.updatedAt).to.be.greaterThan(before);
    });

    it("changes status independently", async function () {
      await expect(registry.connect(admin).setStatus(1, STATUS_UNDER_CONTRACT))
        .to.emit(registry, "OpportunityStatusChanged")
        .withArgs(1, STATUS_UNDER_CONTRACT);
      expect((await registry.getOpportunity(1)).status).to.equal(STATUS_UNDER_CONTRACT);
    });

    it("reverts on unknown id", async function () {
      await expect(
        registry.connect(admin).updateOpportunity(99, "x", "y", 60, 1n),
      )
        .to.be.revertedWithCustomError(registry, "OpportunityNotFound")
        .withArgs(99);
    });
  });

  describe("setMemo (MEMO_ROLE)", function () {
    beforeEach(async function () {
      await registry
        .connect(admin)
        .addOpportunity(
          ANCHOR.addressLine,
          ANCHOR.neighborhood,
          ANCHOR.operatorName,
          ANCHOR.amiTier,
          ANCHOR.listPrice,
          STATUS_AVAILABLE,
          ethers.ZeroHash,
          "",
        );
    });

    it("memo bot can update memo without modifying underlying", async function () {
      const newHash = ethers.id("memo-v2");
      const newUri = "ipfs://QmMemoV2";

      await expect(registry.connect(memoBot).setMemo(1, newHash, newUri))
        .to.emit(registry, "MemoUpdated")
        .withArgs(1, newHash, newUri);

      const op = await registry.getOpportunity(1);
      expect(op.memoHash).to.equal(newHash);
      expect(op.memoUri).to.equal(newUri);
    });

    it("rejects callers without MEMO_ROLE", async function () {
      await expect(
        registry.connect(other).setMemo(1, ethers.ZeroHash, ""),
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("memo bot CANNOT update underlying opportunity", async function () {
      await expect(
        registry.connect(memoBot).updateOpportunity(1, "x", "y", 60, 1n),
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });
  });
});
