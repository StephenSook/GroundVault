// ChainGPT Web3 LLM client. Generates an Impact Risk Memo for a housing
// opportunity. The flow:
//   1. Build a context-rich prompt from the opportunity metadata + cost-
//      burden snapshot + benchmark rate.
//   2. POST to /chat/stream with the web3_llm model.
//   3. Receive markdown body, compute keccak256, anchor on chain via
//      GroundVaultRegistry.setMemo.
//
// Docs: https://docs.chaingpt.org/

import { keccak256, toUtf8Bytes } from "ethers";

export interface MemoGenerationRequest {
  opportunityId: string;
  prompt: string;
}

export interface MemoGenerationResult {
  markdown: string;
  hash: `0x${string}`;
  ipfsUri: string;
}

const ENDPOINT = "https://api.chaingpt.org/chat/stream";

function buildPrompt(
  opportunity: {
    address: string;
    neighborhood: string;
    operator: string;
    amiTier: number;
    listPriceUsd: number;
  },
  context: { costBurdenSeverePct: number; treasuryRatePct: number | null },
): string {
  return `Write a four-section institutional impact risk memo for the following housing opportunity. Sections must be: 1. Opportunity summary, 2. Financial benchmark, 3. Social impact thesis, 4. Risk caveats. Plain English, ~2-3 paragraphs per section. Markdown formatting with H2 headers per section.

Property: ${opportunity.address} (${opportunity.neighborhood})
Operator: ${opportunity.operator}
Affordability: ≤${opportunity.amiTier}% Area Median Income, permanently restricted via Community Land Trust covenant.
List price: $${opportunity.listPriceUsd.toLocaleString()} USD.
Local context: ${opportunity.neighborhood} sits in Atlanta (Fulton County GA). ${context.costBurdenSeverePct}% of Fulton County renters are severely cost-burdened (>50% of income on housing).
Benchmark rate: ${
    context.treasuryRatePct !== null ? `${context.treasuryRatePct.toFixed(2)}% (10-year US Treasury, FRED DGS10)` : "10-year Treasury benchmark (current rate unavailable)"
  }.

Audience: institutional impact investors evaluating GroundVault — a confidential RWA lending vault for Community Land Trusts on iExec Nox + Arbitrum Sepolia.

Important constraints:
- Reg D 506(c) testnet prototype. Do NOT claim mainnet readiness.
- Do NOT recommend specific allocation sizes or yield projections.
- Risk section MUST disclose hackathon scope: this is a testnet prototype, not a production-grade investment vehicle.`;
}

async function callServerProxy(
  opportunity: Parameters<typeof buildPrompt>[0],
  context: Parameters<typeof buildPrompt>[1],
): Promise<string | null> {
  // Try the Vercel Edge proxy at /api/chaingpt first. The proxy keeps
  // the API key server-side so it never enters the bundle. Returns null
  // (rather than throwing) when the proxy is unreachable / not deployed
  // so the caller can fall through to the dev direct path.
  let res: Response;
  try {
    res = await fetch("/api/chaingpt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunity, context }),
    });
  } catch {
    return null;
  }
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return null; // SPA fallback hit
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(
      `ChainGPT proxy HTTP ${res.status}: ${detail?.error ?? "unknown error"}`,
    );
  }
  const data = await res.json().catch(() => null);
  if (typeof data?.markdown !== "string") return null;
  return data.markdown;
}

async function callDirect(
  opportunity: Parameters<typeof buildPrompt>[0],
  context: Parameters<typeof buildPrompt>[1],
): Promise<string> {
  const apiKey = import.meta.env.VITE_CHAINGPT_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error(
      "ChainGPT not available: /api/chaingpt proxy returned no JSON and VITE_CHAINGPT_API_KEY is not set. Set CHAINGPT_API_KEY on the deployment, or VITE_CHAINGPT_API_KEY locally for dev.",
    );
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "general_assistant",
      question: buildPrompt(opportunity, context),
      chatHistory: "off",
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "<unreadable>");
    throw new Error(`ChainGPT HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const raw = await res.text();
  return raw
    .split("\n")
    .map((line) => (line.startsWith("data:") ? line.slice(5).trimStart() : line))
    .join("\n")
    .trim();
}

/**
 * Programmatic fallback memo. Used when ChainGPT is unavailable
 * (insufficient credits, rate limit, network failure) so the demo
 * recording can complete end-to-end with a real on-chain anchor over
 * a real-data narrative — just without the LLM generation step.
 *
 * The body is composed from the same opportunity + context inputs the
 * live prompt would have used, so HUD CHAS cost-burden and FRED
 * DGS10 numbers are still live data. The narrative is hand-built
 * but flagged in the body so a viewer reading the memo can tell it
 * came from the fallback path. Anchoring the keccak256 of this body
 * on chain still demonstrates the audit-trail mechanism.
 */
function buildFallbackMemo(
  opportunity: Parameters<typeof buildPrompt>[0],
  context: Parameters<typeof buildPrompt>[1],
): string {
  const treasury =
    context.treasuryRatePct !== null
      ? `${context.treasuryRatePct.toFixed(2)}% (10-year US Treasury, FRED DGS10)`
      : "10-year Treasury benchmark (current rate unavailable)";
  const list = opportunity.listPriceUsd.toLocaleString();

  return `> Fallback memo — ChainGPT API unavailable. Body composed locally from live HUD CHAS + FRED data; on-chain hash still anchored to GroundVaultRegistry.

## 1. Opportunity summary

${opportunity.address} sits in ${opportunity.neighborhood}, an Atlanta neighborhood in Fulton County, GA. The property is offered by ${opportunity.operator} under a permanent affordability covenant restricting ownership to households earning ≤${opportunity.amiTier}% of Area Median Income. List price is $${list} USD.

The acquisition is part of the Trust at Oakland City mixed-income development, in which roughly half of the units are permanently affordable and half are market-rate, co-developed by Atlanta Land Trust, Cityscape Housing, and Intown Builders with Atlanta BeltLine support.

## 2. Financial benchmark

The risk-free benchmark used for this evaluation is ${treasury}. CLT-financed acquisition is not a yield-seeking position; the underwriting goal is preservation of permanent affordability rather than market-comparable return. The benchmark anchors the opportunity cost of capital for institutional impact investors evaluating an allocation to GroundVault.

GroundVault deposits are denominated in confidential cUSDC (ERC-7984). Vault aggregate supply, individual investor positions, and pending acquisition capital are all encrypted at the chain level — a public chain reader sees only bytes32 handles. This eliminates the predatory front-running pattern that has cost mission-driven CLTs visible-treasury acquisition bids in the past.

## 3. Social impact thesis

${context.costBurdenSeverePct}% of Fulton County renters are severely cost-burdened (>50% of income on housing) per HUD's Comprehensive Housing Affordability Strategy data. Atlanta lost roughly 1,500 affordable units per year over the prior decade and saw 22,149 Black residents displaced from sixteen majority-Black census tracts between 1980 and 2020 (NCRC 2025).

Each unit added to a Community Land Trust inventory is permanently removed from speculative resale, which directly counters that displacement pattern. CLT homes had foreclosure rates 80–90 percent below conventional during the 2007–2009 crisis (Lincoln Institute / Thaden 2010), and CLT residents save approximately $153,000 in housing costs over a 12-year hold versus market-rate (Grounded Solutions).

## 4. Risk caveats

GroundVault is a Reg D 506(c) **testnet prototype** deployed to Arbitrum Sepolia (chain id 421614). Mainnet readiness, SEC-grade compliance, and any production deployment require qualified securities counsel and full audits. Nothing in this memo, the deployed UI, or the supporting contracts represents a production-grade investment vehicle. ChainGPT-generated memos in production runs are non-binding research narratives, not investment advice.

The deposit lifecycle (Wrap → confidentialTransfer → recordDeposit → processDeposit → claimDeposit) has been audited by ChainGPT's Smart Contract Auditor over all 11 production contracts; findings and remediations are recorded in the project's audits/ directory. The hackathon scope explicitly excludes IPFS pinning of memo bodies, multi-opportunity registries, and the cancelDepositTimeout refund flow.`;
}

/**
 * Decide whether a ChainGPT error should silently degrade to the local
 * fallback memo. The previous policy was an opt-in allowlist of
 * substrings ("insufficient credits", "rate limit", "quota", "429",
 * "ChainGPT not available") which had two failure modes:
 *
 * 1. False positives — a 429 from the proxy itself (just rate-limited
 *    by Vercel edge) would silently fall back, losing real ChainGPT
 *    generation that a 30-second retry would fix. "quota" matched any
 *    error message that contained the substring incidentally.
 * 2. False negatives — HTTP 5xx from the ChainGPT upstream (server-
 *    side outage, exactly the case fallback was built for) was a hard
 *    error because the message did not match an allowlist substring.
 *    "Failed to fetch" / "Network error" likewise hard-failed.
 *
 * The new policy parses the HTTP status code out of error messages of
 * the form "ChainGPT HTTP 429: ...", then falls back only on:
 * - HTTP 429 (rate limited)
 * - HTTP 5xx (upstream outage, including missing CHAINGPT_API_KEY 500)
 * - Network failures with no status (TypeError "Failed to fetch")
 * - Literal "insufficient credits" string match (ChainGPT-specific
 *   business-logic error that always wants the fallback)
 *
 * Everything else (4xx auth/validation errors, malformed responses)
 * surfaces to the user as a hard "Memo regenerate failed" toast.
 */
function shouldFallback(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "");
  const lower = msg.toLowerCase();

  if (lower.includes("insufficient credits")) return true;

  const statusMatch = msg.match(/HTTP\s+(\d{3})/i);
  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10);
    if (status === 429) return true;
    if (status >= 500 && status <= 599) return true;
    return false;
  }

  // No status was attached — most likely a network-layer rejection.
  if (
    lower.includes("failed to fetch") ||
    lower.includes("network error") ||
    lower.includes("econnrefused") ||
    lower.includes("etimedout")
  ) {
    return true;
  }

  return false;
}

export async function generateMemo(
  opportunity: Parameters<typeof buildPrompt>[0],
  context: Parameters<typeof buildPrompt>[1],
): Promise<{ markdown: string; hash: `0x${string}`; source: "chaingpt" | "fallback" }> {
  // Server proxy first (production path). Direct fallback for `vite dev`
  // where /api/chaingpt is not served. If both ChainGPT paths fail with
  // a soft error the caller can still anchor a fallback memo.
  try {
    const proxied = await callServerProxy(opportunity, context);
    const markdown = proxied ?? (await callDirect(opportunity, context));
    return {
      markdown,
      hash: keccak256(toUtf8Bytes(markdown)) as `0x${string}`,
      source: "chaingpt",
    };
  } catch (err) {
    if (!shouldFallback(err)) throw err;
    // Log the original error before degrading so a demo recording or
    // post-hoc review can tell what triggered the fallback. Without
    // this line a flaky network blip and a real ChainGPT outage look
    // identical from the screen capture.
    console.error("ChainGPT call failed — using fallback memo:", err);
    const markdown = buildFallbackMemo(opportunity, context);
    return {
      markdown,
      hash: keccak256(toUtf8Bytes(markdown)) as `0x${string}`,
      source: "fallback",
    };
  }
}
