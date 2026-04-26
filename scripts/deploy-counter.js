const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("Network:        ", hre.network.name);
  console.log("Chain id:       ", hre.network.config.chainId);
  console.log("Deployer:       ", deployer.address);
  console.log("Balance (wei):  ", balance.toString());

  const Counter = await hre.ethers.getContractFactory("Counter");
  console.log("Sending deploy tx...");
  const counter = await Counter.deploy();
  await counter.waitForDeployment();

  const addr = await counter.getAddress();
  const tx = counter.deploymentTransaction();
  console.log("Counter:        ", addr);
  console.log("Tx hash:        ", tx.hash);
  console.log("");
  console.log("Verify with:");
  console.log(`  npx hardhat verify --network ${hre.network.name} ${addr}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
