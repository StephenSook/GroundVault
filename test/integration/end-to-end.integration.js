// End-to-end integration test against live Arbitrum Sepolia.
//
// Run with:
//   npx hardhat test test/integration/end-to-end.integration.js --network arbitrumSepolia
//
// File suffix is `.integration.js` so the CI hardhat-test glob
// (`*.test.js`) ignores it; this file is manual-run only because it
// requires the Nox precompile, which is not deployed on the local
// hardhat network.
//
// Hackathon-scope simplifications documented elsewhere:
// - Deployer wallet is also the test investor. Same wallet is the
//   trusted KYC issuer registered during Phase 3 deploy AND the
//   investor receiving shares. Production model splits these.
// - recordDeposit performs no on-chain verification that the matching
//   confidentialTransfer happened first. We do both in sequence and
//   trust the encrypted handles match. Phase 2.6 hardening replaces
//   this with TEE-oracle verification or confidentialTransferFrom.

const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const TOPIC_KYC = 1n;
const SCHEME_ECDSA = 1n;
const COUNTRY_US = 840;

const DEPLOY = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "..", "deployments", "arbitrumSepolia.json"),
    "utf8",
  ),
);

describe("End-to-end deposit flow on Arbitrum Sepolia", function () {
  this.timeout(15 * 60 * 1000); // 15 min — sequential live txs + TEE roundtrips

  let deployer;
  let user;
  let mUsdc;
  let cusdc;
  let identityRegistry;
  let shareToken;
  let vault;
  let handleClient;

  before(async function () {
    if (hre.network.name !== "arbitrumSepolia") {
      this.skip();
    }

    [deployer] = await ethers.getSigners();
    user = deployer; // hackathon scope: deployer is also test investor

    console.log(`  Deployer / test user: ${deployer.address}`);
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`  Balance: ${ethers.formatEther(balance)} ETH`);

    const { createEthersHandleClient } = await import("@iexec-nox/handle");
    handleClient = await createEthersHandleClient(deployer);

    mUsdc = await ethers.getContractAt("MockUSDC", DEPLOY.contracts.MockUSDC.address);
    cusdc = await ethers.getContractAt("cUSDC", DEPLOY.contracts.cUSDC.address);
    identityRegistry = await ethers.getContractAt(
      "IdentityRegistry",
      DEPLOY.contracts.IdentityRegistry.address,
    );
    shareToken = await ethers.getContractAt(
      "GroundVaultToken",
      DEPLOY.contracts.GroundVaultToken.address,
    );
    vault = await ethers.getContractAt(
      "GroundVaultCore",
      DEPLOY.contracts.GroundVaultCore.address,
    );
  });

  it("step 1 — verify the user is KYC'd in IdentityRegistry", async function () {
    const existing = await identityRegistry.identity(user.address);

    if (existing === ethers.ZeroAddress) {
      console.log("    user has no identity yet — deploying + registering");
      const Identity = await ethers.getContractFactory("Identity");
      const id = await Identity.deploy(user.address);
      await id.waitForDeployment();
      const idAddr = await id.getAddress();
      console.log(`    Identity deployed: ${idAddr}`);

      const claimData = ethers.toUtf8Bytes("hackathon-kyc-claim");
      const dataHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["address", "uint256", "bytes"],
          [idAddr, TOPIC_KYC, claimData],
        ),
      );
      const sig = await deployer.signMessage(ethers.getBytes(dataHash));

      await (
        await id.addClaim(TOPIC_KYC, SCHEME_ECDSA, deployer.address, sig, claimData, "")
      ).wait();
      console.log("    KYC claim added to Identity");

      await (
        await identityRegistry.registerIdentity(user.address, idAddr, COUNTRY_US)
      ).wait();
      console.log("    Identity registered with IdentityRegistry");
    } else {
      console.log(`    user already has Identity at ${existing}`);
    }

    expect(await identityRegistry.isVerified(user.address)).to.equal(true);
  });

  // Idempotency: this test runs against persistent live-chain state.
  // Re-runs accumulate cUSDC balances, share balances, and deposit
  // queue state across investors. Every assertion uses BEFORE/AFTER
  // deltas so the test is correct regardless of pre-existing state,
  // and so a no-op contract surface gets caught by the delta being
  // zero rather than an absolute hardcoded value happening to match.

  const wrapAmount = 100_000_000n; // 100 mUSDC at 6 decimals
  const depositAmount = 50_000_000n;

  async function decryptBalance(handle) {
    if (handle === ethers.ZeroHash) return 0n;
    const { value } = await handleClient.decrypt(handle);
    return value;
  }

  it("step 2 — mint mUSDC, approve, wrap into encrypted cUSDC (delta = wrapAmount)", async function () {
    const beforeHandle = await cusdc.confidentialBalanceOf(user.address);
    const before = await decryptBalance(beforeHandle);
    console.log(`    cUSDC balance before wrap: ${before}`);

    await (await mUsdc.mint(user.address, wrapAmount)).wait();
    await (await mUsdc.approve(await cusdc.getAddress(), wrapAmount)).wait();
    await (await cusdc.wrap(wrapAmount)).wait();
    console.log(`    wrapped ${wrapAmount} mUSDC`);

    const afterHandle = await cusdc.confidentialBalanceOf(user.address);
    expect(afterHandle).to.not.equal(ethers.ZeroHash);
    const after = await decryptBalance(afterHandle);
    console.log(`    cUSDC balance after wrap: ${after}`);

    expect(after - before).to.equal(wrapAmount);
  });

  it("step 3 — confidentialTransfer cUSDC to vault (user delta = -depositAmount)", async function () {
    const beforeHandle = await cusdc.confidentialBalanceOf(user.address);
    const before = await decryptBalance(beforeHandle);

    const { handle, handleProof } = await handleClient.encryptInput(
      depositAmount,
      "uint256",
      await cusdc.getAddress(),
    );
    await (
      await cusdc.confidentialTransfer(await vault.getAddress(), handle, handleProof)
    ).wait();
    console.log("    transfer mined");

    const afterHandle = await cusdc.confidentialBalanceOf(user.address);
    const after = await decryptBalance(afterHandle);
    console.log(`    cUSDC balance after transfer: ${after} (was ${before})`);

    expect(before - after).to.equal(depositAmount);
  });

  it("step 4 — recordDeposit on vault (pending delta = +depositAmount)", async function () {
    const beforeHandle = await vault.pendingDepositOf(user.address);
    const before = await decryptBalance(beforeHandle);

    const { handle, handleProof } = await handleClient.encryptInput(
      depositAmount,
      "uint256",
      await vault.getAddress(),
    );
    await (await vault.recordDeposit(handle, handleProof)).wait();
    console.log("    recordDeposit mined");

    const afterHandle = await vault.pendingDepositOf(user.address);
    expect(afterHandle).to.not.equal(ethers.ZeroHash);
    const after = await decryptBalance(afterHandle);
    console.log(`    pending after recordDeposit: ${after} (was ${before})`);

    expect(after - before).to.equal(depositAmount);
  });

  it("step 5 — processDeposit (pending -> 0, claimable += pending-before)", async function () {
    const pendingBeforeHandle = await vault.pendingDepositOf(user.address);
    const claimableBeforeHandle = await vault.claimableDepositOf(user.address);
    const pendingBefore = await decryptBalance(pendingBeforeHandle);
    const claimableBefore = await decryptBalance(claimableBeforeHandle);

    await (await vault.processDeposit(user.address)).wait();
    console.log("    processDeposit mined");

    const pendingAfterHandle = await vault.pendingDepositOf(user.address);
    const claimableAfterHandle = await vault.claimableDepositOf(user.address);
    const pendingAfter = await decryptBalance(pendingAfterHandle);
    const claimableAfter = await decryptBalance(claimableAfterHandle);

    console.log(
      `    pending: ${pendingBefore} -> ${pendingAfter}; claimable: ${claimableBefore} -> ${claimableAfter}`,
    );

    expect(pendingAfter).to.equal(0n);
    expect(claimableAfter - claimableBefore).to.equal(pendingBefore);
  });

  it("step 6 — claimDeposit (shares delta = +claimable-before; claimable -> 0)", async function () {
    const claimableBeforeHandle = await vault.claimableDepositOf(user.address);
    const sharesBeforeHandle = await shareToken.confidentialBalanceOf(user.address);
    const claimableBefore = await decryptBalance(claimableBeforeHandle);
    const sharesBefore = await decryptBalance(sharesBeforeHandle);

    await (await vault.claimDeposit()).wait();
    console.log("    claimDeposit mined");

    const claimableAfterHandle = await vault.claimableDepositOf(user.address);
    const sharesAfterHandle = await shareToken.confidentialBalanceOf(user.address);
    const claimableAfter = await decryptBalance(claimableAfterHandle);
    expect(sharesAfterHandle).to.not.equal(ethers.ZeroHash);
    const sharesAfter = await decryptBalance(sharesAfterHandle);

    console.log(
      `    claimable: ${claimableBefore} -> ${claimableAfter}; shares: ${sharesBefore} -> ${sharesAfter}`,
    );

    expect(claimableAfter).to.equal(0n);
    expect(sharesAfter - sharesBefore).to.equal(claimableBefore);
  });
});
