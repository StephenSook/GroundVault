// FRED (St. Louis Fed) API client. Fetches a single observation series
// (e.g. DGS10 = 10-year Treasury constant-maturity yield) and returns
// the most recent value as a benchmark rate for the impact memo.
//
// Docs: https://fred.stlouisfed.org/docs/api/fred/

export interface FredSeriesPoint {
  date: string;
  value: number;
}

const BASE = "https://api.stlouisfed.org/fred/series/observations";

export async function fetchSeries(seriesId: string = "DGS10"): Promise<FredSeriesPoint[]> {
  const apiKey = import.meta.env.VITE_FRED_API_KEY as string | undefined;
  if (!apiKey) return [];

  try {
    const url =
      `${BASE}?series_id=${encodeURIComponent(seriesId)}` +
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

export async function fetchLatestRate(seriesId: string = "DGS10"): Promise<number | null> {
  const points = await fetchSeries(seriesId);
  if (points.length === 0) return null;
  return points[points.length - 1].value;
}
