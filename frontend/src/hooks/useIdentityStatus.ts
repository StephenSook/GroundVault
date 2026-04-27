import { useEffect, useState } from "react";

import { useContracts } from "@/hooks/useContracts";
import type { IdentityRecord, IdentityStatus } from "@/types";

/**
 * Reads on-chain identity state for a wallet. `?status=` query param still
 * works as a design-state override so the verify screen's three branches
 * are demoable without an actual wallet — any non-empty `?status=verified`
 * etc. takes precedence over the chain read.
 */
export function useIdentityStatus(wallet?: string) {
  const { identityRegistry, claimTopicsRegistry } = useContracts();

  const [status, setStatus] = useState<IdentityStatus>("unverified");
  const [identity, setIdentity] = useState<IdentityRecord | null>(null);
  const [investorCountry, setInvestorCountry] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const queryOverride =
      typeof window !== "undefined"
        ? (new URLSearchParams(window.location.search).get("status") as IdentityStatus | null)
        : null;
    if (queryOverride === "verified" || queryOverride === "pending" || queryOverride === "unverified") {
      setStatus(queryOverride);
      setIdentity(
        queryOverride === "verified"
          ? { contract: "0x71C0…976F", jurisdiction: "840 (US)", claims: ["KYC topic 1"] }
          : null,
      );
      setInvestorCountry(queryOverride === "verified" ? "US" : "");
      return;
    }

    if (!wallet) {
      setStatus("unverified");
      setIdentity(null);
      setInvestorCountry("");
      return;
    }

    setIsLoading(true);

    (async () => {
      try {
        const [identityAddr, country, verified, requiredTopics] = await Promise.all([
          identityRegistry.identity(wallet) as Promise<string>,
          identityRegistry.investorCountry(wallet) as Promise<bigint>,
          identityRegistry.isVerified(wallet) as Promise<boolean>,
          claimTopicsRegistry.getClaimTopics() as Promise<bigint[]>,
        ]);

        if (cancelled) return;

        const hasIdentity = identityAddr !== "0x0000000000000000000000000000000000000000";

        let nextStatus: IdentityStatus;
        if (verified) nextStatus = "verified";
        else if (hasIdentity) nextStatus = "pending";
        else nextStatus = "unverified";

        setStatus(nextStatus);
        setIdentity(
          hasIdentity
            ? {
                contract: identityAddr,
                jurisdiction: `${country.toString()} (${
                  Number(country) === 840 ? "US" : "—"
                })`,
                claims: requiredTopics.map((t) => `Topic ${t.toString()}`),
              }
            : null,
        );
        setInvestorCountry(Number(country) === 840 ? "US" : country.toString());
      } catch (err: any) {
        if (!cancelled) {
          console.error("useIdentityStatus error:", err);
          // Distinguish "actually unverified on chain" from "we couldn't
          // read the chain". Setting unverified on a transient RPC error
          // booted real verified users into /verify with no warning, so
          // the gate now shows an "unknown" status with a retry path.
          setStatus("unknown");
          setIdentity(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wallet, identityRegistry, claimTopicsRegistry]);

  return { status, identity, investorCountry, isLoading };
}
