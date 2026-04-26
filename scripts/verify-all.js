const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const network = hre.network.name;
  const deploymentsFile = path.join(__dirname, "..", "deployments", `${network}.json`);
  if (!fs.existsSync(deploymentsFile)) {
    console.error(`No deployments file at ${deploymentsFile}. Run deploy-all.js first.`);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentsFile, "utf8"));
  console.log(`Verifying ${Object.keys(deployment.contracts).length} contracts on ${network}...`);

  let ok = 0;
  let already = 0;
  let failed = 0;

  for (const [name, info] of Object.entries(deployment.contracts)) {
    process.stdout.write(`\n[${name}] ${info.address} `);
    try {
      await hre.run("verify:verify", {
        address: info.address,
        constructorArguments: info.constructorArgs,
      });
      console.log("verified");
      ok += 1;
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      if (msg.includes("Already Verified") || msg.includes("already verified")) {
        console.log("already verified");
        already += 1;
      } else {
        console.log("FAILED");
        console.log(`  ${msg}`);
        failed += 1;
      }
    }
  }

  console.log(`\n=== Verify summary ===`);
  console.log(`  newly verified: ${ok}`);
  console.log(`  already:        ${already}`);
  console.log(`  failed:         ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
