const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const TIMEOUT = 24 * 60 * 60; // 24 hours
const COUNTRY_US = 840;
const TOPIC_KYC = 1;

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const chainId = hre.network.config.chainId;
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("=== GroundVault Phase 3 Deploy ===");
  console.log("Network:        ", network, `(chain ${chainId})`);
  console.log("Deployer:       ", deployer.address);
  console.log("Balance (wei):  ", balance.toString());
  console.log("");

  const deployment = {
    network,
    chainId,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {},
  };

  async function deploy(name, factoryName, args) {
    process.stdout.write(`Deploying ${name} ... `);
    const Factory = await hre.ethers.getContractFactory(factoryName);
    const contract = await Factory.deploy(...args);
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    const tx = contract.deploymentTransaction();
    const receipt = await tx.wait();

    deployment.contracts[name] = {
      address,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      constructorArgs: args.map((a) => (a && a.toString ? a.toString() : a)),
    };

    console.log(address);
    return contract;
  }

  async function send(label, txPromise) {
    process.stdout.write(`  ${label} ... `);
    const tx = await txPromise;
    await tx.wait();
    console.log("ok");
  }

  // --- Layer 1: independents ----------------------------------------
  const claimTopics = await deploy("ClaimTopicsRegistry", "ClaimTopicsRegistry", [
    deployer.address,
  ]);
  const trustedIssuers = await deploy("TrustedIssuersRegistry", "TrustedIssuersRegistry", [
    deployer.address,
  ]);
  const compliance = await deploy("ModularCompliance", "ModularCompliance", [deployer.address]);
  const usdc = await deploy("MockUSDC", "MockUSDC", [deployer.address]);
  const housingRegistry = await deploy("GroundVaultRegistry", "GroundVaultRegistry", [
    deployer.address,
  ]);

  // --- Layer 2 ------------------------------------------------------
  const identityRegistry = await deploy("IdentityRegistry", "IdentityRegistry", [
    deployer.address,
    await claimTopics.getAddress(),
    await trustedIssuers.getAddress(),
  ]);
  const cusdc = await deploy("cUSDC", "cUSDC", [await usdc.getAddress()]);

  // --- Layer 3 ------------------------------------------------------
  const jurisdictionModule = await deploy("JurisdictionModule", "JurisdictionModule", [
    deployer.address,
    await identityRegistry.getAddress(),
  ]);
  const shareToken = await deploy("GroundVaultToken", "GroundVaultToken", [
    deployer.address,
    await identityRegistry.getAddress(),
    await compliance.getAddress(),
  ]);

  // --- Layer 4 ------------------------------------------------------
  const vault = await deploy("GroundVaultCore", "GroundVaultCore", [
    deployer.address,
    await identityRegistry.getAddress(),
    await shareToken.getAddress(),
    await cusdc.getAddress(),
    TIMEOUT,
  ]);

  // --- Layer 5 ------------------------------------------------------
  const router = await deploy("GroundVaultRouter", "GroundVaultRouter", [
    await shareToken.getAddress(),
    await vault.getAddress(),
  ]);

  // --- Configuration ------------------------------------------------
  console.log("\nConfiguring...");

  await send(
    "claimTopics.addClaimTopic(1) — KYC required",
    claimTopics.addClaimTopic(TOPIC_KYC),
  );

  await send(
    `trustedIssuers.addTrustedIssuer(deployer, [${TOPIC_KYC}])`,
    trustedIssuers.addTrustedIssuer(deployer.address, [TOPIC_KYC]),
  );

  await send(
    "compliance.bindToken(shareToken)",
    compliance.bindToken(await shareToken.getAddress()),
  );

  await send(
    "compliance.addModule(jurisdictionModule)",
    compliance.addModule(await jurisdictionModule.getAddress()),
  );

  await send(
    `jurisdictionModule.addAllowedCountry(${COUNTRY_US}) — US`,
    jurisdictionModule.addAllowedCountry(COUNTRY_US),
  );

  const VAULT_ROLE = await shareToken.VAULT_ROLE();
  await send(
    "shareToken.grantRole(VAULT_ROLE, vault)",
    shareToken.grantRole(VAULT_ROLE, await vault.getAddress()),
  );

  await send(
    "housingRegistry.addOpportunity(960 Lawton)",
    housingRegistry.addOpportunity(
      "960 Lawton St SW, Atlanta, GA",
      "Oakland City",
      "Atlanta Land Trust",
      80,                // 80% AMI
      25_000_000n,       // $250,000 in cents
      0,                 // OpportunityStatus.Available
      hre.ethers.ZeroHash, // memo hash placeholder, set later by ChainGPT bot
      "",
    ),
  );

  // --- Persist artifacts --------------------------------------------
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir);
  const file = path.join(deploymentsDir, `${network}.json`);
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2) + "\n");

  console.log("\n=== Deploy complete ===");
  console.log("Wrote", file);
  console.log("");
  console.log("Summary:");
  for (const [name, info] of Object.entries(deployment.contracts)) {
    console.log(`  ${name.padEnd(28)} ${info.address}`);
  }

  const finalBalance = await hre.ethers.provider.getBalance(deployer.address);
  const used = balance - finalBalance;
  console.log(`\nGas used (wei): ${used.toString()}`);
  console.log(`Final balance:  ${finalBalance.toString()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
