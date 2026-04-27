// Vercel Edge function. Proxies the FRED (St. Louis Fed) observations
// endpoint so the frontend can read DGS10 / other series without
// hitting the CORS wall — FRED does not set Access-Control-Allow-Origin
// and direct browser fetches always fail. The proxy also keeps the
// FRED API key out of the production bundle (use FRED_API_KEY without
// the VITE_ prefix on Vercel).
//
// Client contract: GET /api/fred?seriesId=DGS10&limit=30
//   200:     { observations: [{ date: string, value: number }] }
//   4xx/5xx: { error: string, detail?: string }

export const config = { runtime: "edge" };

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";
// FRED series IDs are at least 2 characters in practice (e.g. "M2",
// "DGS10"). Tightened from {1,16} to avoid passing trivially-empty
// inputs through to the upstream.
const VALID_SERIES = /^[A-Za-z0-9]{2,16}$/;

const ALLOWED_HOST_SUFFIXES = [".vercel.app"];
const ALLOWED_HOSTNAMES = new Set(["localhost"]);

function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (ALLOWED_HOSTNAMES.has(url.hostname)) return true;
  if (ALLOWED_HOST_SUFFIXES.some((s) => url.hostname.endsWith(s))) return true;
  const extra = (globalThis as any).process?.env?.ALLOWED_ORIGIN as string | undefined;
  if (extra && origin === extra) return true;
  return false;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return jsonResponse(405, { error: "method not allowed" });
  }

  if (!isAllowedOrigin(req)) {
    return jsonResponse(403, { error: "origin not allowed" });
  }

  const apiKey = (globalThis as any).process?.env?.FRED_API_KEY as string | undefined;
  if (!apiKey) {
    return jsonResponse(500, { error: "FRED_API_KEY not configured on the server" });
  }

  const url = new URL(req.url);
  const seriesId = url.searchParams.get("seriesId") ?? "DGS10";
  const limitRaw = url.searchParams.get("limit") ?? "30";

  // Reject anything outside the FRED series-id grammar so a malicious
  // client cannot drive the proxy at unrelated endpoints.
  if (!VALID_SERIES.test(seriesId)) {
    return jsonResponse(400, { error: "invalid seriesId" });
  }
  const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 30, 1), 100);

  const upstream = await fetch(
    `${FRED_BASE}?series_id=${encodeURIComponent(seriesId)}&api_key=${encodeURIComponent(apiKey)}&file_type=json&sort_order=desc&limit=${limit}`,
    { method: "GET" },
  );

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return jsonResponse(502, {
      error: `FRED upstream HTTP ${upstream.status}`,
      detail: detail.slice(0, 400),
    });
  }

  const json = (await upstream.json().catch(() => null)) as any;
  if (!json || !Array.isArray(json.observations)) {
    return jsonResponse(502, { error: "FRED response missing observations array" });
  }

  const observations = json.observations
    .filter((o: any) => o.value !== "." && !Number.isNaN(Number(o.value)))
    .map((o: any) => ({ date: String(o.date), value: Number(o.value) }))
    .reverse(); // oldest first

  return jsonResponse(200, { observations });
}
