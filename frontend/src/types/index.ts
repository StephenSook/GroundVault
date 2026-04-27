export type IdentityStatus = "unverified" | "pending" | "verified" | "unknown";

export interface IdentityRecord {
  contract: string;
  jurisdiction: string;
  claims: string[];
}

export type DepositStep = "wrap" | "request" | "pending" | "claim";

export interface Opportunity {
  id: string;
  rwaId: string;
  address: string;
  city: string;
  neighborhood: string;
  status: "Available" | "Funded" | "Coming soon";
  bedBath: string;
  sqft: number;
  targetPrice: number;
  affordability: string;
  heroImage: string;
}

export interface MemoSection {
  title: string;
  body: string;
  bullets?: string[];
  table?: { label: string; value: string }[];
}

export interface MemoProvenance {
  generator: string;
  timestampUtc: string;
  onChainHash: string;
  storageUri: string;
  verified: boolean;
  /**
   * Set when the on-chain memo was anchored over the local fallback
   * memo (ChainGPT was unavailable at generation time). The
   * ProvenancePanel renders a distinct "fallback memo anchored" badge
   * for this case so the integrity story is honest about provenance.
   */
  isFallback?: boolean;
}

export interface ImpactMemo {
  opportunityId: string;
  title: string;
  preparedFor: string;
  sections: MemoSection[];
  provenance: MemoProvenance;
}

export interface EncryptedHandle {
  handle: string;        // e.g. "0xa3fc...891"
  /** Plaintext only available locally for ACL holders (mock). */
  plaintext?: string;
}
