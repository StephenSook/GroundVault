// FRED (St. Louis Fed) API client. Tries the Vercel Edge proxy at
// /api/fred first (server-side key, no CORS). Falls through to a
// direct call against api.stlouisfed.org if the proxy is unreachable
// — the direct call will CORS-fail in browser builds but stays
// compatible with Node-side test runners that bypass CORS. Both
// paths return the same FredSeriesPoint[] shape and swallow errors
// to an empty array so a failed read shows as "rate unavailable" in
// the impact memo prompt rather than throwing.
//
// Docs: https://fred.stlouisfed.org/docs/api/fred/

export interface FredSeriesPoint {
  date: string;
  value: number;
}

const DIRECT_BASE = "https://api.stlouisfed.org/fred/series/observations";

async function callServerProxy(seriesId: string): Promise<FredSeriesPoint[] | null> {
  let res: Response;
  try {
    res = await fetch(`/api/fred?seriesId=${encodeURIComponent(seriesId)}&limit=30`);
  } catch {
    return null;
  }
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return null; // SPA 404 fallback
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data || !Array.isArray(data.observations)) return null;
  return data.observations as FredSeriesPoint[];
}

async function callDirect(seriesId: string): Promise<FredSeriesPoint[]> {
  const apiKey = import.meta.env.VITE_FRED_API_KEY as string | undefined;
  if (!apiKey) return [];

  try {
    const url =
      `${DIRECT_BASE}?series_id=${encodeURIComponent(seriesId)}` +
      `&api_key=${encodeURIComponent(apiKey)}` +
      `&file_type=json&sort_order=desc&limit=30`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    if (!Array.isArray(json.observations)) return [];

    return json.observations
      .filter((o: any) => o.value !== "." && !Number.isNaN(Number(o.value)))
      .map((o: any) => ({ date: o.date as string, value: Number(o.value) }))
      .reverse();
  } catch {
    return [];
  }
}

export async function fetchSeries(seriesId: string = "DGS10"): Promise<FredSeriesPoint[]> {
  const proxied = await callServerProxy(seriesId);
  if (proxied !== null) return proxied;
  return callDirect(seriesId);
}

export async function fetchLatestRate(seriesId: string = "DGS10"): Promise<number | null> {
  const points = await fetchSeries(seriesId);
  if (points.length === 0) return null;
  return points[points.length - 1].value;
}
