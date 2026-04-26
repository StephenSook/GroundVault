const { expect } = require("chai");
const { ethers } = require("hardhat");

const TOPIC_KYC = 1n;
const SCHEME_ECDSA = 1n;
const COUNTRY_US = 840;

async function signClaim(signer, identityAddress, topic, data) {
  const dataHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes"],
      [identityAddress, topic, data],
    ),
  );
  return signer.signMessage(ethers.getBytes(dataHash));
}

async function deployVerifiedStack() {
  const [admin, vault, kycIssuer, user, recipient, other] = await ethers.getSigners();

  const ClaimTopics = await ethers.getContractFactory("ClaimTopicsRegistry");
  const claimTopics = await ClaimTopics.deploy(admin.address);
  await claimTopics.waitForDeployment();
  await claimTopics.connect(admin).addClaimTopic(TOPIC_KYC);

  const TrustedIssuers = await ethers.getContractFactory("TrustedIssuersRegistry");
  const trustedIssuers = await TrustedIssuers.deploy(admin.address);
  await trustedIssuers.waitForDeployment();
  await trustedIssuers.connect(admin).addTrustedIssuer(kycIssuer.address, [TOPIC_KYC]);

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

  const Token = await ethers.getContractFactory("GroundVaultToken");
  const token = await Token.deploy(
    admin.address,
    await identityRegistry.getAddress(),
    await compliance.getAddress(),
  );
  await token.waitForDeployment();

  await compliance.connect(admin).bindToken(await token.getAddress());
  await token.connect(admin).grantRole(await token.VAULT_ROLE(), vault.address);

  // Verify `user` and `recipient`.
  const Identity = await ethers.getContractFactory("Identity");
  const userIdentity = await Identity.deploy(user.address);
  await userIdentity.waitForDeployment();
  const recipientIdentity = await Identity.deploy(recipient.address);
  await recipientIdentity.waitForDeployment();

  for (const [signer, idContract, idAddrSigner] of [
    [user, userIdentity, user],
    [recipient, recipientIdentity, recipient],
  ]) {
    const idAddr = await idContract.getAddress();
    const data = ethers.toUtf8Bytes("kyc-001");
    const sig = await signClaim(kycIssuer, idAddr, TOPIC_KYC, data);
    await idContract
      .connect(idAddrSigner)
      .addClaim(TOPIC_KYC, SCHEME_ECDSA, kycIssuer.address, sig, data, "");
    await identityRegistry
      .connect(admin)
      .registerIdentity(signer.address, idAddr, COUNTRY_US);
  }

  return {
    admin,
    vault,
    user,
    recipient,
    other,
    identityRegistry,
    compliance,
    token,
  };
}

describe("GroundVaultToken (structural)", function () {
  describe("constructor", function () {
    it("rejects zero-address registries", async function () {
      const [admin] = await ethers.getSigners();
      const Token = await ethers.getContractFactory("GroundVaultToken");
      await expect(
        Token.deploy(admin.address, ethers.ZeroAddress, ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(Token, "ZeroAddressIdentityRegistry");
    });

    it("grants admin DEFAULT_ADMIN_ROLE and emits registry-set events", async function () {
      const { admin, token } = await deployVerifiedStack();
      expect(await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), admin.address)).to.equal(true);
    });

    it("exposes the configured registry pointers", async function () {
      const { token, identityRegistry, compliance } = await deployVerifiedStack();
      expect(await token.identityRegistry()).to.equal(await identityRegistry.getAddress());
      expect(await token.compliance()).to.equal(await compliance.getAddress());
    });
  });

  describe("metadata", function () {
    it("reports name, symbol, decimals", async function () {
      const { token } = await deployVerifiedStack();
      expect(await token.name()).to.equal("GroundVault Share");
      expect(await token.symbol()).to.equal("gvSHARE");
      expect(await token.decimals()).to.equal(18);
    });
  });

  describe("admin: registry pointers + pause", function () {
    it("admin can swap identityRegistry; non-admin cannot", async function () {
      const { admin, other, token, identityRegistry } = await deployVerifiedStack();
      await token.connect(admin).setIdentityRegistry(await identityRegistry.getAddress());

      await expect(
        token.connect(other).setIdentityRegistry(await identityRegistry.getAddress()),
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("admin can pause and unpause", async function () {
      const { admin, token } = await deployVerifiedStack();
      await token.connect(admin).pause();
      expect(await token.paused()).to.equal(true);
      await token.connect(admin).unpause();
      expect(await token.paused()).to.equal(false);
    });

    it("rejects zero-address replacements", async function () {
      const { admin, token } = await deployVerifiedStack();
      await expect(
        token.connect(admin).setIdentityRegistry(ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(token, "ZeroAddressIdentityRegistry");
      await expect(
        token.connect(admin).setCompliance(ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(token, "ZeroAddressCompliance");
    });
  });

  describe("confidentialMint pre-Nox revert paths", function () {
    const placeholderHandle = ethers.ZeroHash;
    const placeholderProof = "0x";

    it("reverts when called by non-VAULT_ROLE", async function () {
      const { other, recipient, token } = await deployVerifiedStack();
      await expect(
        token.connect(other).confidentialMint(recipient.address, placeholderHandle, placeholderProof),
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("reverts on zero address recipient", async function () {
      const { vault, token } = await deployVerifiedStack();
      await expect(
        token.connect(vault).confidentialMint(ethers.ZeroAddress, placeholderHandle, placeholderProof),
      ).to.be.revertedWithCustomError(token, "MintToZero");
    });

    it("reverts when recipient is not verified", async function () {
      const { vault, other, token } = await deployVerifiedStack();
      await expect(
        token.connect(vault).confidentialMint(other.address, placeholderHandle, placeholderProof),
      )
        .to.be.revertedWithCustomError(token, "RecipientNotVerified")
        .withArgs(other.address);
    });

    it("reverts when paused", async function () {
      const { admin, vault, recipient, token } = await deployVerifiedStack();
      await token.connect(admin).pause();
      await expect(
        token.connect(vault).confidentialMint(recipient.address, placeholderHandle, placeholderProof),
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });
  });

  describe("confidentialBurn pre-Nox revert paths", function () {
    const placeholderHandle = ethers.ZeroHash;
    const placeholderProof = "0x";

    it("reverts when called by non-VAULT_ROLE", async function () {
      const { other, user, token } = await deployVerifiedStack();
      await expect(
        token.connect(other).confidentialBurn(user.address, placeholderHandle, placeholderProof),
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("reverts on zero-address source", async function () {
      const { vault, token } = await deployVerifiedStack();
      await expect(
        token.connect(vault).confidentialBurn(ethers.ZeroAddress, placeholderHandle, placeholderProof),
      ).to.be.revertedWithCustomError(token, "BurnFromZero");
    });

    it("reverts when source is not verified", async function () {
      const { vault, other, token } = await deployVerifiedStack();
      await expect(
        token.connect(vault).confidentialBurn(other.address, placeholderHandle, placeholderProof),
      )
        .to.be.revertedWithCustomError(token, "SenderNotVerified")
        .withArgs(other.address);
    });
  });

  describe("confidentialTransfer pre-Nox revert paths", function () {
    const placeholderHandle = ethers.ZeroHash;
    const placeholderProof = "0x";

    it("reverts on transfer to zero", async function () {
      const { user, token } = await deployVerifiedStack();
      await expect(
        token.connect(user).confidentialTransfer(ethers.ZeroAddress, placeholderHandle, placeholderProof),
      ).to.be.revertedWithCustomError(token, "TransferToZero");
    });

    it("reverts on transfer to self", async function () {
      const { user, token } = await deployVerifiedStack();
      await expect(
        token.connect(user).confidentialTransfer(user.address, placeholderHandle, placeholderProof),
      ).to.be.revertedWithCustomError(token, "TransferToSelf");
    });

    it("reverts when sender is not verified", async function () {
      const { other, recipient, token } = await deployVerifiedStack();
      await expect(
        token.connect(other).confidentialTransfer(recipient.address, placeholderHandle, placeholderProof),
      )
        .to.be.revertedWithCustomError(token, "SenderNotVerified")
        .withArgs(other.address);
    });

    it("reverts when recipient is not verified", async function () {
      const { user, other, token } = await deployVerifiedStack();
      await expect(
        token.connect(user).confidentialTransfer(other.address, placeholderHandle, placeholderProof),
      )
        .to.be.revertedWithCustomError(token, "RecipientNotVerified")
        .withArgs(other.address);
    });

    it("reverts when paused", async function () {
      const { admin, user, recipient, token } = await deployVerifiedStack();
      await token.connect(admin).pause();
      await expect(
        token.connect(user).confidentialTransfer(recipient.address, placeholderHandle, placeholderProof),
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("reverts when a compliance module rejects", async function () {
      const { admin, user, recipient, compliance, token } = await deployVerifiedStack();

      const Mock = await ethers.getContractFactory("MockModule");
      const denyingModule = await Mock.deploy(false); // canTransfer = false
      await denyingModule.waitForDeployment();
      await compliance.connect(admin).addModule(await denyingModule.getAddress());

      await expect(
        token.connect(user).confidentialTransfer(recipient.address, placeholderHandle, placeholderProof),
      ).to.be.revertedWithCustomError(token, "ComplianceRejectedTransfer");
    });
  });

  describe("view functions before any mint", function () {
    it("reports the zero handle for empty balances and supply", async function () {
      const { user, token } = await deployVerifiedStack();
      expect(await token.confidentialBalanceOf(user.address)).to.equal(ethers.ZeroHash);
      expect(await token.confidentialTotalSupply()).to.equal(ethers.ZeroHash);
    });
  });
});
