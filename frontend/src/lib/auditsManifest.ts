// Build-time manifest of every ChainGPT audit report under
// `<repo>/audits/*.md`. Vite inlines the raw markdown at compile time
// via `import.meta.glob`, so this module ships zero runtime fetches.
//
// The .md files themselves are the source of truth. This file only
// extracts severity counts + section bodies for the /audits route's
// summary cards — the full report stays in markdown so a judge can
// follow the GitHub link and read the original ChainGPT response.

import type { ContractName } from "@/lib/contracts";

const RAW_AUDITS = import.meta.glob("../../../audits/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export type Severity = "critical" | "high" | "medium" | "low" | "informational";

export interface AuditSummary {
  /** Filename stem — e.g. `GroundVaultCore`. README.md is excluded. */
  name: string;
  /** True when the stem matches a known ContractName, false for special cases like "Identity" (per-user OnchainID, not in DEPLOYMENT). */
  isDeployedContract: boolean;
  /** Maps the stem to the deployment lookup key when applicable. */
  contractName: ContractName | null;
  /** Severity → count of distinct findings. */
  counts: Record<Severity, number>;
  /** First Critical finding title (used as the card subhead) or null. */
  topCritical: string | null;
  /** Generated date, parsed from "Generated: <iso>" line. */
  generatedAt: string | null;
  /** Solidity source path inside the repo, parsed from "Source path: ..." line. */
  sourcePath: string | null;
  /** Full markdown body for inline rendering / collapse. */
  body: string;
}

const STEM_TO_CONTRACT: Record<string, ContractName | null> = {
  ClaimTopicsRegistry: "ClaimTopicsRegistry",
  TrustedIssuersRegistry: "TrustedIssuersRegistry",
  IdentityRegistry: "IdentityRegistry",
  Identity: null, // per-user OnchainID, not in DEPLOYMENT
  ModularCompliance: "ModularCompliance",
  JurisdictionModule: "JurisdictionModule",
  cUSDC: "cUSDC",
  GroundVaultToken: "GroundVaultToken",
  GroundVaultCore: "GroundVaultCore",
  GroundVaultRegistry: "GroundVaultRegistry",
};

const SEVERITY_HEADER = /^####\s+\*\*(Critical|High|Medium|Low|Informational)\*\*/gim;
// Matches a hyphen-prefixed bullet whose content starts with bold text — these
// are the per-finding lines inside a severity section. Sub-bullets like
// "  - **Recommendation**: …" are excluded by the leading single `-`.
const FINDING_BULLET = /^-\s+\*\*[^*]+?\*\*/gm;

function parseSeverityCounts(body: string): Record<Severity, number> {
  const sectionRanges: { sev: Severity; start: number; end: number }[] = [];
  const matches = Array.from(body.matchAll(SEVERITY_HEADER));
  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i];
    const sev = m[1].toLowerCase() as Severity;
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? body.length) : body.length;
    sectionRanges.push({ sev, start, end });
  }
  const counts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    informational: 0,
  };
  for (const { sev, start, end } of sectionRanges) {
    const slice = body.slice(start, end);
    counts[sev] += Array.from(slice.matchAll(FINDING_BULLET)).length;
  }
  return counts;
}

function parseTopCritical(body: string): string | null {
  const idx = body.search(/####\s+\*\*Critical\*\*/i);
  if (idx < 0) return null;
  // Look for the first bullet starting `- **<title>**:` after the Critical header.
  const after = body.slice(idx);
  const bulletMatch = after.match(/-\s+\*\*([^*]+?)\*\*\s*:/);
  return bulletMatch ? bulletMatch[1].trim() : null;
}

function parseHeaderField(body: string, label: string): string | null {
  const re = new RegExp(`^${label}:\\s*(.+)$`, "im");
  const m = body.match(re);
  return m ? m[1].trim() : null;
}

function buildSummary(filePath: string, body: string): AuditSummary {
  const stem = filePath.split("/").pop()?.replace(/\.md$/, "") ?? "(unknown)";
  const contractName = STEM_TO_CONTRACT[stem] ?? null;
  return {
    name: stem,
    isDeployedContract: contractName !== null,
    contractName,
    counts: parseSeverityCounts(body),
    topCritical: parseTopCritical(body),
    generatedAt: parseHeaderField(body, "Generated"),
    sourcePath: parseHeaderField(body, "Source path")?.replace(/`/g, "") ?? null,
    body,
  };
}

const ALL: AuditSummary[] = Object.entries(RAW_AUDITS)
  .filter(([path]) => !path.endsWith("/README.md"))
  .map(([path, body]) => buildSummary(path, body))
  .sort((a, b) => a.name.localeCompare(b.name));

export const AUDITS = ALL;

export function severityTotals(): Record<Severity, number> {
  return ALL.reduce(
    (acc, a) => {
      (Object.keys(a.counts) as Severity[]).forEach((s) => {
        acc[s] += a.counts[s];
      });
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0, informational: 0 } as Record<Severity, number>,
  );
}
