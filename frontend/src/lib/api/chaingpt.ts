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
      model: "web3_llm",
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

export async function generateMemo(
  opportunity: Parameters<typeof buildPrompt>[0],
  context: Parameters<typeof buildPrompt>[1],
): Promise<{ markdown: string; hash: `0x${string}` }> {
  // Server proxy first (production path). Direct fallback for `vite dev`
  // where /api/chaingpt is not served.
  const proxied = await callServerProxy(opportunity, context);
  const markdown = proxied ?? (await callDirect(opportunity, context));
  return { markdown, hash: keccak256(toUtf8Bytes(markdown)) as `0x${string}` };
}

/**
 * Pin markdown to IPFS via a pinning service. The default scaffolds a
 * placeholder URI when no pinning credentials are configured — wire a
 * real Pinata / Web3.Storage / Filebase client in a follow-up commit
 * once Phase 5's pinning account is provisioned.
 */
export async function pinMemoToIpfs(_markdown: string): Promise<string> {
  return "ipfs://pending-pinning-service";
}
