import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

// Sources backing the GroundVault impact memo. Numbers in the
// fallback memo body and the live ChainGPT prompt both derive from
// these. Surfacing them next to the memo lets a judge or auditor
// trace any specific claim back to its primary source — the
// audit-trail story is on-chain (keccak256 anchor) AND off-chain
// (verifiable citations).
interface Citation {
  id: string;
  category: string;
  title: string;
  source: string;
  url: string;
  takeaway: string;
}

const CITATIONS: Citation[] = [
  {
    id: "jchs-2024",
    category: "Cost burden",
    title: "America's Rental Housing 2024",
    source: "Joint Center for Housing Studies of Harvard University",
    url: "https://www.jchs.harvard.edu/americas-rental-housing-2024",
    takeaway:
      "22.6M U.S. renter households cost-burdened (record). 12.1M severely cost-burdened (>50% income).",
  },
  {
    id: "hud-chas",
    category: "Cost burden",
    title: "Comprehensive Housing Affordability Strategy (CHAS) Data",
    source: "U.S. Department of Housing and Urban Development",
    url: "https://www.huduser.gov/portal/dataset/chas-api.html",
    takeaway:
      "County-level renter cost-burden tiers. The dashboard pulls Fulton County GA (FIPS 13121) live via bearer-token API.",
  },
  {
    id: "ncrc-2025",
    category: "Atlanta displacement",
    title: "Gentrification and Disinvestment 2020",
    source: "National Community Reinvestment Coalition (NCRC)",
    url: "https://ncrc.org/gentrification20/",
    takeaway:
      "National framework for measuring gentrification and Black-resident displacement across U.S. metros, with Atlanta among the highest-displacement cohorts.",
  },
  {
    id: "lincoln-clt",
    category: "Community Land Trusts",
    title: "Community Land Trusts and Stable Affordable Housing",
    source: "Lincoln Institute of Land Policy / Thaden 2010",
    url: "https://www.lincolninst.edu/publications/articles/community-land-trusts",
    takeaway:
      "CLT homes had foreclosure rates 80–90% lower than conventional during the 2007–2009 crisis. ~308 CLTs operate across 48 U.S. states.",
  },
  {
    id: "grounded-savings",
    category: "Community Land Trusts",
    title: "Lasting Affordability: CLT Resale Outcomes",
    source: "Grounded Solutions Network",
    url: "https://groundedsolutions.org/strengthening-neighborhoods/community-land-trusts",
    takeaway:
      "CLT residents save approximately $153,000 in housing costs over a 12-year hold versus market-rate.",
  },
  {
    id: "raymond-gt-2021",
    category: "Predatory acquisition",
    title: "From Foreclosure to Eviction: Housing Insecurity in Corporate-Owned Single-Family Rentals",
    source: "Raymond, Duckworth, Miller, Lucas, Pokharel — Georgia Tech, 2021",
    url: "https://nature.com/articles/s41599-021-00984-7",
    takeaway:
      "Investor purchases caused neighborhoods to lose ~166 Black residents and gain ~109 White over 6 years versus controls.",
  },
  {
    id: "wired-realt",
    category: "Predatory acquisition",
    title: "WIRED coverage of RealT in Detroit",
    source: "WIRED Magazine search archive",
    url: "https://www.wired.com/search/?q=RealT+Detroit",
    takeaway:
      "RealT, the largest U.S. residential tokenization platform, accumulated ~500 buildings in Detroit. Detroit pursued enforcement action in 2024 over hundreds of blight violations across the platform's portfolio.",
  },
  {
    id: "fred-dgs10",
    category: "Financial benchmark",
    title: "10-Year Treasury Constant Maturity Rate (DGS10)",
    source: "Federal Reserve Bank of St. Louis (FRED)",
    url: "https://fred.stlouisfed.org/series/DGS10",
    takeaway:
      "Daily 10-year U.S. Treasury yield. Used as the risk-free benchmark in the impact memo's financial section.",
  },
  {
    id: "rwa-xyz",
    category: "Tokenized RWA market",
    title: "RWA.xyz market dashboard",
    source: "RWA.xyz",
    url: "https://app.rwa.xyz",
    takeaway:
      "~$35.9B of RWA tokenized on-chain as of November 2025 (+131% YTD). $0 of which is permanent affordability housing.",
  },
  {
    id: "alt-listing",
    category: "Live opportunity",
    title: "960 Lawton St SW — Permanently Affordable Listing",
    source: "Atlanta Land Trust",
    url: "https://atlantalandtrust.org/find-a-home/",
    takeaway:
      "Live availability of the demo's anchor property at the Trust at Oakland City development.",
  },
  {
    id: "iexec-nox",
    category: "Confidential compute",
    title: "iExec Nox — TEE Confidential Execution",
    source: "iExec",
    url: "https://docs.iex.ec/",
    takeaway:
      "TEE-based confidential compute layer for ERC-7984 handles. Audited by Halborn; Arbitrum Sepolia testnet support since 2025-11.",
  },
  {
    id: "erc-7984",
    category: "Standards",
    title: "ERC-7984: Confidential Fungible Token",
    source: "OpenZeppelin + Zama (finalized 2025-07)",
    url: "https://eips.ethereum.org/EIPS/eip-7984",
    takeaway:
      "Encrypted-balance ERC-20-shaped token standard. Balances are bytes32 handles only ACL holders can decrypt.",
  },
  {
    id: "erc-3643",
    category: "Standards",
    title: "ERC-3643: T-REX Permissioned Token",
    source: "Tokeny + ERC-3643 Association",
    url: "https://eips.ethereum.org/EIPS/eip-3643",
    takeaway:
      "$32B+ tokenized assets across 40+ tokens. Enforces KYC + claim attestations on every transfer via the IdentityRegistry stack.",
  },
];

export function CitationsPanel() {
  const [open, setOpen] = useState(false);
  const grouped = groupBy(CITATIONS, (c) => c.category);

  return (
    <div className="rounded-lg border border-border bg-card mt-8" data-print-hidden>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
      >
        <div>
          <div className="font-display text-lg text-forest">Citations &amp; sources</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {CITATIONS.length} primary sources backing the memo's claims · grouped by topic
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="border-t border-border px-6 py-5 space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <section key={category}>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                {category}
              </div>
              <ul className="space-y-3">
                {items.map((c) => (
                  <li key={c.id} className="space-y-0.5">
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-baseline gap-1.5 text-sm font-medium text-forest hover:underline underline-offset-2"
                    >
                      {c.title}
                      <ExternalLink className="h-3 w-3 self-center" />
                    </a>
                    <div className="text-[11px] text-muted-foreground">{c.source}</div>
                    <div className="text-xs text-foreground/80">{c.takeaway}</div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function groupBy<T, K extends string>(arr: T[], key: (t: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of arr) {
    const k = key(item);
    if (!out[k]) out[k] = [];
    out[k].push(item);
  }
  return out;
}
