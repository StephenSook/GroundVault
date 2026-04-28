// Vercel Edge function. Proxies the ChainGPT Web3 LLM call so the API
// key stays server-side instead of being inlined into the production
// bundle as VITE_CHAINGPT_API_KEY would.
//
// Client contract: POST /api/chaingpt
//   body:    { opportunity: OppShape, context: CtxShape }
//   200:     { markdown: string }
//   4xx/5xx: { error: string, detail?: string }
//
// Set CHAINGPT_API_KEY (no VITE_ prefix) on the Vercel project. Local
// `vite dev` does not run this route; the client lib falls back to a
// direct call via VITE_CHAINGPT_API_KEY for the dev path.

export const config = { runtime: "edge" };

const CHAINGPT_ENDPOINT = "https://api.chaingpt.org/chat/stream";

// Cap user-supplied string fields so a malicious caller cannot send
// kilobyte-long opportunity descriptions and burn ChainGPT credits via
// inflated prompt size.
const MAX_STR = 200;

interface OppShape {
  address: string;
  neighborhood: string;
  operator: string;
  amiTier: number;
  listPriceUsd: number;
}

interface CtxShape {
  costBurdenSeverePct: number;
  treasuryRatePct: number | null;
}

// Origin allowlist for the proxy. Originally `*.vercel.app` to allow
// preview-deploy aliases, but that lets ANY Vercel-hosted site (a
// random side project at `attacker.vercel.app`) burn ChainGPT credits
// by calling this endpoint. Tightened to:
//   - exact-match GroundVault aliases (4 of them)
//   - the per-deploy URL pattern `frontend-<hash>-ssookra-7703s-projects.vercel.app`
//   - localhost for dev
// Additional custom-domain origins can be added via ALLOWED_ORIGIN env var.
const ALLOWED_EXACT_HOSTS = new Set([
  "groundvault-app.vercel.app",
  "groundvault-clt.vercel.app",
  "groundvault-iexec.vercel.app",
  "groundvault-housing.vercel.app",
  "localhost",
]);
const ALLOWED_HOST_REGEX = /^frontend-[a-z0-9]+-ssookra-7703s-projects\.vercel\.app$/i;

function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (ALLOWED_EXACT_HOSTS.has(url.hostname)) return true;
  if (ALLOWED_HOST_REGEX.test(url.hostname)) return true;
  const extra = (globalThis as any).process?.env?.ALLOWED_ORIGIN as string | undefined;
  if (extra && origin === extra) return true;
  return false;
}

function buildPrompt(opp: OppShape, ctx: CtxShape): string {
  const treasuryLine =
    ctx.treasuryRatePct !== null
      ? `${ctx.treasuryRatePct.toFixed(2)}% (10-year US Treasury, FRED DGS10)`
      : "10-year Treasury benchmark (current rate unavailable)";

  return `Write a four-section institutional impact risk memo for the following housing opportunity. Sections must be: 1. Opportunity summary, 2. Financial benchmark, 3. Social impact thesis, 4. Risk caveats. Plain English, ~2-3 paragraphs per section. Markdown formatting with H2 headers per section.

Property: ${opp.address} (${opp.neighborhood})
Operator: ${opp.operator}
Affordability: ≤${opp.amiTier}% Area Median Income, permanently restricted via Community Land Trust covenant.
List price: $${opp.listPriceUsd.toLocaleString()} USD.
Local context: ${opp.neighborhood} sits in Atlanta (Fulton County GA). ${ctx.costBurdenSeverePct}% of Fulton County renters are severely cost-burdened (>50% of income on housing).
Benchmark rate: ${treasuryLine}.

Audience: institutional impact investors evaluating GroundVault — a confidential RWA lending vault for Community Land Trusts on iExec Nox + Arbitrum Sepolia.

Important constraints:
- Reg D 506(c) testnet prototype. Do NOT claim mainnet readiness.
- Do NOT recommend specific allocation sizes or yield projections.
- Risk section MUST disclose hackathon scope: this is a testnet prototype, not a production-grade investment vehicle.`;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isValidPayload(body: any): body is { opportunity: OppShape; context: CtxShape } {
  if (!body || typeof body !== "object") return false;
  const opp = body.opportunity;
  const ctx = body.context;
  if (!opp || typeof opp !== "object") return false;
  if (!ctx || typeof ctx !== "object") return false;
  if (
    typeof opp.address !== "string" ||
    opp.address.length === 0 ||
    opp.address.length > MAX_STR
  ) {
    return false;
  }
  if (typeof opp.neighborhood !== "string" || opp.neighborhood.length > MAX_STR) return false;
  if (typeof opp.operator !== "string" || opp.operator.length > MAX_STR) return false;
  if (typeof opp.amiTier !== "number" || opp.amiTier <= 0 || opp.amiTier > 200) return false;
  if (
    typeof opp.listPriceUsd !== "number" ||
    opp.listPriceUsd < 0 ||
    opp.listPriceUsd > 1_000_000_000
  ) {
    return false;
  }
  if (typeof ctx.costBurdenSeverePct !== "number") return false;
  if (ctx.costBurdenSeverePct < 0 || ctx.costBurdenSeverePct > 100) return false;
  if (ctx.treasuryRatePct !== null && typeof ctx.treasuryRatePct !== "number") return false;
  return true;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "method not allowed" });
  }

  if (!isAllowedOrigin(req)) {
    return jsonResponse(403, { error: "origin not allowed" });
  }

  const apiKey = (globalThis as any).process?.env?.CHAINGPT_API_KEY as string | undefined;
  if (!apiKey) {
    // Generic 5xx body — the specific cause (missing env var) is in
    // the server-side console only. Don't announce env var names to
    // anonymous callers who are probably probing for misconfigured
    // deployments.
    console.error("[/api/chaingpt] CHAINGPT_API_KEY not set");
    return jsonResponse(500, { error: "service unavailable" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid JSON body" });
  }

  if (!isValidPayload(body)) {
    return jsonResponse(400, { error: "malformed payload — expected { opportunity, context }" });
  }

  const upstream = await fetch(CHAINGPT_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "general_assistant",
      question: buildPrompt(body.opportunity, body.context),
      chatHistory: "off",
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return jsonResponse(502, {
      error: `ChainGPT upstream HTTP ${upstream.status}`,
      detail: detail.slice(0, 400),
    });
  }

  const raw = await upstream.text();
  const markdown = raw
    .split("\n")
    .map((line) => (line.startsWith("data:") ? line.slice(5).trimStart() : line))
    .join("\n")
    .trim();

  return jsonResponse(200, { markdown });
}
