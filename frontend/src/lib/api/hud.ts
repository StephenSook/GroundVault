// HUD CHAS API client. Pulls Comprehensive Housing Affordability Strategy
// data for a county (FIPS code). Fulton County, GA = 13121. The API
// requires a bearer token; for the GroundVault demo the token is exposed
// as VITE_HUD_API_TOKEN, with a static fallback table when the token is
// missing or the request fails (so the demo still renders without keys).
//
// Spec: https://www.huduser.gov/portal/dataset/chas-api.html
// Data field: D9 -- Cost Burden >50% Total (severely cost-burdened share).

export interface CostBurdenBreakdown {
  severelyBurdenedPct: number; // > 50% of income on housing
  costBurdenedPct: number;     // 30-50%
  notBurdenedPct: number;      // < 30%
  source: "live" | "fallback";
}

const FALLBACK: CostBurdenBreakdown = {
  severelyBurdenedPct: 26,
  costBurdenedPct: 24,
  notBurdenedPct: 50,
  source: "fallback",
};

const BASE = "https://www.huduser.gov/hudapi/public/chas";

export async function fetchCostBurden(countyFips: string = "13121"): Promise<CostBurdenBreakdown> {
  const token = import.meta.env.VITE_HUD_API_TOKEN as string | undefined;
  if (!token) {
    console.warn("HUD CHAS: no VITE_HUD_API_TOKEN — falling back to static numbers");
    return FALLBACK;
  }

  try {
    // CHAS endpoint: /chas?type=3&year=2017-2021&stateId=13&entityId=121
    const stateId = countyFips.slice(0, 2);
    const entityId = countyFips.slice(2);
    const url = `${BASE}?type=3&year=2017-2021&stateId=${stateId}&entityId=${entityId}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      console.warn(`HUD CHAS: HTTP ${res.status} — falling back to static numbers`);
      return FALLBACK;
    }
    const json = await res.json();

    // The CHAS payload has dozens of fields; we read the renter-household
    // cost-burden tier shares (D9 family). The exact field names follow
    // the HUD documentation.
    const row = Array.isArray(json) ? json[0] : json;
    if (!row) {
      console.warn("HUD CHAS: empty response — falling back to static numbers");
      return FALLBACK;
    }

    const totalRenters = Number(row.B5_est ?? row.B5 ?? 0);
    const severelyBurdenedRenters = Number(row.B5C_est ?? row.B5C ?? 0);
    const moderatelyBurdenedRenters = Number(row.B5B_est ?? row.B5B ?? 0);
    if (!totalRenters || totalRenters <= 0) {
      console.warn(
        "HUD CHAS: B5/B5_est missing or zero — payload shape may have changed; falling back to static numbers",
      );
      return FALLBACK;
    }

    const sev = Math.round((severelyBurdenedRenters / totalRenters) * 100);
    const mod = Math.round((moderatelyBurdenedRenters / totalRenters) * 100);
    const not = Math.max(0, 100 - sev - mod);

    return { severelyBurdenedPct: sev, costBurdenedPct: mod, notBurdenedPct: not, source: "live" };
  } catch (err) {
    console.warn("HUD CHAS: fetch threw — falling back to static numbers:", err);
    return FALLBACK;
  }
}
