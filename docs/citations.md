# Research Citations

> Every statistic in the GroundVault pitch and demo is sourced. Judges who want to verify can follow these links.

This file lives in the public repository so reviewers can audit claims directly. Last updated: 2026-04-25.

---

## Anchor property — Atlanta Land Trust, "Trust at Oakland City"

**Address**: 964 Lawton St SW, Atlanta, GA 30310
**Listed price**: $196,713
**Restriction**: ≤80% Area Median Income (AMI)
**Operator**: Atlanta Land Trust (ALT) — https://atlantalandtrust.org
**Project context**: ALT closed a $14M capital campaign in late 2023 to build 90 permanently affordable units across Oakland City and East Lake; broke ground Dec 2022 on 36 townhomes (29 permanently affordable) at "The Avenue at Oakland City"
**Source**: Atlanta Land Trust public listings + Coxe Curry "State of Affordable Housing in Atlanta" report, 2024

> Note: source URL for the specific listing to be added once verified. If the listing has rotated off the public site, archive a snapshot via web.archive.org and link the snapshot here.

---

## Cost-burden + housing supply

| Stat | Source |
|---|---|
| 22.6M U.S. renter households cost-burdened (>30% of income on housing) — record high | Harvard Joint Center for Housing Studies, *America's Rental Housing 2024* / *State of the Nation's Housing 2024 + 2025* |
| 12.1M severely cost-burdened (>50% of income) | Harvard JCHS 2024 |
| HUD Worst Case Housing Needs: 5M → 8.5M households over 20 years | HUD User / JCHS |
| Among renters earning <$30K, 83% cost-burdened, 65% severely | Harvard JCHS 2024 |
| 350,000+ affordable units at risk of losing affordability by 2030 | National Housing Preservation Database / Grounded Solutions |

---

## Atlanta gentrification + displacement

| Stat | Source |
|---|---|
| 22,149 Black residents displaced from 16 majority-Black Atlanta census tracts (1980-2020) | NCRC, *Displaced By Design*, May 2025 |
| 155 majority-Black Atlanta neighborhoods flipped majority-white (1980-2020) | Black Enterprise / NCRC |
| Atlanta = #4 nationally for gentrification eliminating majority-Black tracts | Axios Atlanta / NCRC |
| Old Fourth Ward median home value: ~$345K (2010) → >$1.7M (2020) | 11Alive on NCRC |
| Avg 1-bedroom rent: $1,315 (Jul 2019) → $2,098 (Jul 2024) | Property Owners Alliance, 2024 |
| Atlanta loses ~1,500 affordable units annually | Coxe Curry, 2024 |
| Georgia Black homeownership: 47% vs white 76% (29-point gap) | Property Owners Alliance, 2024 |
| Wealth ratio in Atlanta: $46 white per $1 Black | Community Foundation for Greater Atlanta, July 2024 / GRO Fund |

---

## Community Land Trusts

| Stat | Source |
|---|---|
| ~308 CLTs across 48 states + DC + PR (2024) | Lincoln Institute of Land Policy / Wikipedia |
| ~10,000-15,000 CLT homeownership units, ~20,000 rental units | PolicyLink |
| CLT homes had foreclosure rates ~80-90% lower than conventional during 2007-2009 | Thaden, "Outperforming the Market," Lincoln Institute, 2010 / Community-Wealth.org |
| ~60% of CLT owners who sold in past decade went on to purchase another home | Grounded Solutions / Chronicle of Philanthropy |
| CLT residents save ~$153K in housing costs over 12 years vs market rate | Grounded Solutions |
| Capital Magnet Fund FY2024: 4.3-8.5x oversubscribed ($1.06B requested, $246.4M awarded) | U.S. Treasury, Feb 2024 |

---

## Predatory acquisition vector

| Stat | Source |
|---|---|
| Eviction judgments grew 8% annually 2000-2016; same-site apartment sale prices rose avg $5.5M; investor purchases caused neighborhoods to lose 166 Black residents and gain 109 White over 6 years vs controls | Raymond et al. (Georgia Tech, 2021), via NLIHC PDF |
| RealT (largest real-estate tokenization platform) snapped up ~500 buildings in Detroit; Detroit sued in 2024 over "hundreds of blight violations" | Wired investigation, "Two Literal Crypto Bros Built a Real Estate Empire. Then the Homes Started to Fall Apart" |
| Blackstone holds >300,000 residential units (149K multifamily, 63K single-family, 70 mobile home parks, 144,300 student-housing beds) | Institute for Policy Studies / GroundVault Implementation Pack |

---

## RWA market

| Stat | Source |
|---|---|
| $35.9B total tokenized RWA on-chain (Nov 2025), +131% YTD | IXS Finance / RWA.xyz |
| ~$29B (Q1 2026), 263% YoY growth | InvestaX, *Q1 2026 RWA Tokenization Market Report* |
| ERC-3643: $32B+ tokenized assets, 40+ tokens issued, ISO standardization initiative underway | ERC3643.org |
| McKinsey base case: ~$2T tokenized RWA by 2030 (bull: $4T) | McKinsey, June 2024, via The Defiant |
| Deloitte: ~$4T tokenized real estate by 2035 | Deloitte forecast |

---

## iExec / confidential DeFi

| Stat | Source |
|---|---|
| iExec Nox: TEE-based confidential execution layer; Arbitrum mainnet + Sepolia testnet (testnet support 2025-11-04) | Decrypt, Sept 2025; CoinMarketCap recap |
| Audited by Halborn; partners include AR.IO and Aethir | Decrypt 2025 |
| ERC-7984 Confidential Fungible Token: co-authored by OpenZeppelin and Zama | EIP-7984, July 2025 |
| ERC-7540 Async Vault: finalized Ethereum standard, used in production by Centrifuge at $500M+ AUM | EIP-7540 / QuillAudits 2025 |
| ERC-7984 spec | https://eips.ethereum.org/EIPS/eip-7984 |
| ERC-7540 spec | https://eips.ethereum.org/EIPS/eip-7540 |
| ERC-3643 spec | https://eips.ethereum.org/EIPS/eip-3643 |

---

## MEV harm baseline

| Stat | Source |
|---|---|
| EigenPhi: ~$17.1B sandwiched volume 30-day window (2024) | Plisio / EigenPhi |
| jaredfromsubway.eth: >$22M cumulative sandwich profit since Mar 2023, ~70% of 2025 ETH sandwich attacks | Plisio / EigenPhi |
| Cumulative MEV >$1B by 2024-2025 | Plisio industry research |

---

## Live data sources used at runtime

| API | URL | Auth |
|---|---|---|
| HUD CHAS | https://www.huduser.gov/portal/dataset/chas-api.html | Bearer token (free) |
| HUD User (FMR / Income Limits) | https://www.huduser.gov/hudapi/public/ | Bearer token (free) |
| FRED (DGS10 Treasury yields) | https://fred.stlouisfed.org/docs/api/fred/ | Free API key |
| ChainGPT Web3 LLM | `POST https://api.chaingpt.org/chat/stream` | Bearer token |
| ChainGPT Smart Contract Auditor | same base URL, `model: smart_contract_auditor` | Bearer token |

---

## Maria — composite persona disclosure

The "Maria" character in the GroundVault pitch is a **composite persona** modeled on real Atlanta-area Community Land Trust executive directors. Specific details (lost 3 properties this year, on-chain bot front-running) compress the documented Raymond et al. + RealT Detroit + ALT Oakland City realities into a single representative narrative. No claim about a specific identifiable person is made.
