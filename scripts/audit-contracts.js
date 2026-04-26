const fs = require("fs");
const path = require("path");

require("dotenv").config();

const API_URL = "https://api.chaingpt.org/chat/stream";
const API_KEY = process.env.CHAINGPT_API_KEY;

const CONTRACTS = [
  { path: "contracts/identity/ClaimTopicsRegistry.sol", name: "ClaimTopicsRegistry" },
  { path: "contracts/identity/TrustedIssuersRegistry.sol", name: "TrustedIssuersRegistry" },
  { path: "contracts/identity/Identity.sol", name: "Identity" },
  { path: "contracts/identity/IdentityRegistry.sol", name: "IdentityRegistry" },
  { path: "contracts/compliance/ModularCompliance.sol", name: "ModularCompliance" },
  { path: "contracts/compliance/modules/JurisdictionModule.sol", name: "JurisdictionModule" },
  { path: "contracts/token/cUSDC.sol", name: "cUSDC" },
  { path: "contracts/token/GroundVaultToken.sol", name: "GroundVaultToken" },
  { path: "contracts/vault/GroundVaultCore.sol", name: "GroundVaultCore" },
  { path: "contracts/registry/GroundVaultRegistry.sol", name: "GroundVaultRegistry" },
  { path: "contracts/router/GroundVaultRouter.sol", name: "GroundVaultRouter" },
];

async function audit(name, source) {
  const body = {
    model: "smart_contract_auditor",
    question: `Please audit the following Solidity contract for security vulnerabilities, gas optimizations, and compliance issues. Return findings categorized by severity (Critical, High, Medium, Low, Informational).\n\nContract name: ${name}\n\nSource:\n\n${source}`,
    chatHistory: "off",
  };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "<unreadable>");
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 500)}`);
  }

  // The /chat/stream endpoint returns a streaming/SSE-like response. Read
  // the full body and let the auditor's prose pass through verbatim. If
  // the format turns out to be SSE-prefixed we strip the leading "data: "
  // tokens.
  const raw = await res.text();
  const cleaned = raw
    .split("\n")
    .map((line) => (line.startsWith("data:") ? line.slice(5).trimStart() : line))
    .join("\n")
    .trim();

  return cleaned;
}

async function main() {
  if (!API_KEY) {
    console.error("CHAINGPT_API_KEY not set in .env");
    process.exit(1);
  }

  const auditsDir = path.join(__dirname, "..", "audits");
  if (!fs.existsSync(auditsDir)) fs.mkdirSync(auditsDir);

  const results = [];
  console.log(`Auditing ${CONTRACTS.length} contracts via ChainGPT...\n`);

  for (const c of CONTRACTS) {
    const sourcePath = path.join(__dirname, "..", c.path);
    process.stdout.write(`[${c.name}] `);
    try {
      const source = fs.readFileSync(sourcePath, "utf8");
      const t0 = Date.now();
      const result = await audit(c.name, source);
      const ms = Date.now() - t0;

      const outFile = path.join(auditsDir, `${c.name}.md`);
      const header = `# ChainGPT Audit — ${c.name}\n\nGenerated: ${new Date().toISOString()}\nResponse time: ${ms} ms\nSource path: \`${c.path}\`\n\n---\n\n`;
      fs.writeFileSync(outFile, header + result + "\n");

      results.push({ name: c.name, ok: true, ms, bytes: result.length });
      console.log(`ok  ${ms}ms  ${result.length}B`);
    } catch (err) {
      console.log(`FAIL  ${err.message}`);
      results.push({ name: c.name, ok: false, error: err.message });
    }
  }

  // Summary
  const summaryFile = path.join(auditsDir, "README.md");
  const ok = results.filter((r) => r.ok).length;
  let summary = "# ChainGPT Smart Contract Audits\n\n";
  summary += "Each contract was submitted to the ChainGPT Smart Contract Auditor (model `smart_contract_auditor`) for security review. Reports are stored alongside this index.\n\n";
  summary += `Date: ${new Date().toISOString().slice(0, 10)}\n`;
  summary += `Submission: iExec Vibe Coding Challenge\n`;
  summary += `Network of deployed contracts: Arbitrum Sepolia (chain 421614)\n\n`;
  summary += `Total contracts audited: ${ok}/${results.length}\n\n`;
  summary += "| Contract | Status | Response time | Report size |\n|---|---|---|---|\n";
  for (const r of results) {
    if (r.ok) {
      summary += `| [${r.name}](${r.name}.md) | ✓ | ${r.ms} ms | ${r.bytes} B |\n`;
    } else {
      summary += `| ${r.name} | ✗ | — | (${r.error}) |\n`;
    }
  }
  summary += "\n## Reading the reports\n\n";
  summary += "Each report leads with the auditor's findings categorized by severity (Critical, High, Medium, Low, Informational). Critical and High findings, if any, are tracked in the GroundVault PR list and addressed before submission. Lower-severity findings are documented for transparency but may not all be addressed in the hackathon scope.\n\n";
  summary += "## Hackathon-scope context\n\n";
  summary += "Several of the audited contracts implement intentional simplifications versus the production T-REX / ERC-7540 specs. These are documented in the contract NatSpec and `feedback.md`, and the auditor is expected to flag them. Examples: single-owner ONCHAINID Identity (no ERC-734 multi-key), folded IdentityRegistryStorage, `confidentialTransferFrom` omitted on cUSDC, `cancelDepositTimeout` stubbed out for Phase 2.6 hardening.\n";
  fs.writeFileSync(summaryFile, summary);

  console.log(`\nAudit summary: ${ok}/${results.length} successful`);
  console.log(`Wrote ${auditsDir}/`);
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
