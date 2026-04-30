// HUD CHAS API client. Pulls Comprehensive Housing Affordability Strategy
// data for a county (FIPS code). Fulton County, GA = 13121. The API
// requires a bearer token; for the GroundVault demo the token is exposed
// as VITE_HUD_API_TOKEN, with a static fallback table when the token is
// missing or the request fails (so the demo still renders without keys).
//
// Spec: https://www.huduser.gov/portal/dataset/chas-api.html
// CHAS Table 3 (county Sum) renter-occupied cost-burden field codes —
// confirmed against the live API response for Fulton County, GA:
//   A17 = total renter-occupied housing units
//   D8  = renter households with severe cost burden (>50% of income)
//   D5  = renter households with moderate cost burden (30%-50%)
// An earlier version of this client read `B5C_est` / `B5C` etc., which
// don't exist in the API response — the parser silently returned 0%
// severely cost-burdened with source="live", and the LLM-generated
// memo faithfully reported the wrong number.

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

    // The CHAS payload has 132 letter-number coded fields per row. We
    // read the renter cost-burden trio (A17 / D8 / D5).
    const row = Array.isArray(json) ? json[0] : json;
    if (!row) {
      console.warn("HUD CHAS: empty response — falling back to static numbers");
      return FALLBACK;
    }

    const totalRenters = Number(row.A17);
    const severelyBurdenedRenters = Number(row.D8);
    const moderatelyBurdenedRenters = Number(row.D5);
    if (!Number.isFinite(totalRenters) || totalRenters <= 0) {
      console.warn(
        "HUD CHAS: A17 missing or zero — payload shape may have changed; falling back to static numbers",
      );
      return FALLBACK;
    }
    // Defensive: if the renter total is non-zero but BOTH burden tiers
    // are zero, the field mapping is almost certainly stale (real
    // Atlanta-sized counties always have non-trivial cost-burdened
    // renter populations). Better to fall back than ship a memo
    // claiming "0% severely cost-burdened" — that exact failure mode
    // is what the original client did with its B5C_est/B5C codes.
    if (severelyBurdenedRenters <= 0 && moderatelyBurdenedRenters <= 0) {
      console.warn(
        "HUD CHAS: both burden tiers zero with non-zero renter total — falling back",
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
