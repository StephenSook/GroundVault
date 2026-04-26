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

  let wrapAmount;
  let depositAmount;

  it("step 2 — mint mUSDC, approve, wrap into encrypted cUSDC", async function () {
    wrapAmount = 100_000_000n; // 100 mUSDC at 6 decimals

    await (await mUsdc.mint(user.address, wrapAmount)).wait();
    console.log(`    minted ${wrapAmount} mUSDC`);

    await (await mUsdc.approve(await cusdc.getAddress(), wrapAmount)).wait();
    console.log("    approved cUSDC");

    await (await cusdc.wrap(wrapAmount)).wait();
    console.log("    wrapped");

    const balanceHandle = await cusdc.confidentialBalanceOf(user.address);
    expect(balanceHandle).to.not.equal(ethers.ZeroHash);

    const { value: cusdcBalance } = await handleClient.decrypt(balanceHandle);
    console.log(`    encrypted cUSDC balance decrypts to: ${cusdcBalance}`);
    expect(cusdcBalance).to.equal(wrapAmount);
  });

  it("step 3 — confidentialTransfer cUSDC to the vault", async function () {
    depositAmount = 50_000_000n; // 50 mUSDC of the 100 wrapped

    const { handle, handleProof } = await handleClient.encryptInput(
      depositAmount,
      "uint256",
      await cusdc.getAddress(),
    );
    console.log("    encrypted transfer amount, calling confidentialTransfer");

    await (
      await cusdc.confidentialTransfer(await vault.getAddress(), handle, handleProof)
    ).wait();
    console.log("    transfer mined");

    const remainingBalanceHandle = await cusdc.confidentialBalanceOf(user.address);
    const { value: remaining } = await handleClient.decrypt(remainingBalanceHandle);
    console.log(`    cUSDC balance after transfer: ${remaining}`);
    expect(remaining).to.equal(wrapAmount - depositAmount);
  });

  it("step 4 — recordDeposit on vault with encrypted amount", async function () {
    const { handle, handleProof } = await handleClient.encryptInput(
      depositAmount,
      "uint256",
      await vault.getAddress(),
    );

    await (await vault.recordDeposit(handle, handleProof)).wait();
    console.log("    recordDeposit mined");

    const pendingHandle = await vault.pendingDepositOf(user.address);
    expect(pendingHandle).to.not.equal(ethers.ZeroHash);

    const { value: pending } = await handleClient.decrypt(pendingHandle);
    console.log(`    pending decrypts to: ${pending}`);
    expect(pending).to.equal(depositAmount);
  });

  it("step 5 — operator processDeposit (1:1 share ratio)", async function () {
    await (await vault.processDeposit(user.address)).wait();
    console.log("    processDeposit mined");

    const pendingHandle = await vault.pendingDepositOf(user.address);
    const claimableHandle = await vault.claimableDepositOf(user.address);

    const { value: pending } = await handleClient.decrypt(pendingHandle);
    const { value: claimable } = await handleClient.decrypt(claimableHandle);

    console.log(`    after processing -- pending: ${pending}, claimable: ${claimable}`);
    expect(pending).to.equal(0n);
    expect(claimable).to.equal(depositAmount);
  });

  it("step 6 — claimDeposit, encrypted shares minted to investor", async function () {
    await (await vault.claimDeposit()).wait();
    console.log("    claimDeposit mined");

    const claimableHandle = await vault.claimableDepositOf(user.address);
    const { value: claimableAfter } = await handleClient.decrypt(claimableHandle);
    expect(claimableAfter).to.equal(0n);

    const sharesHandle = await shareToken.confidentialBalanceOf(user.address);
    expect(sharesHandle).to.not.equal(ethers.ZeroHash);

    const { value: shares } = await handleClient.decrypt(sharesHandle);
    console.log(`    encrypted vault-share balance decrypts to: ${shares}`);
    expect(shares).to.equal(depositAmount);
  });
});
