import { useCallback, useEffect, useState } from "react";

import { useContracts } from "@/hooks/useContracts";
import type { Opportunity } from "@/types";

const STATUS_LABELS: Opportunity["status"][] = ["Available", "Funded", "Coming soon", "Coming soon"];

const FALLBACK_HERO =
  "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80";

/**
 * Fetches a single housing opportunity record from GroundVaultRegistry on
 * Arbitrum Sepolia. The contract returns: addressLine, neighborhood,
 * operatorName, amiTier, listPrice (cents), status enum, memoHash,
 * memoUri, createdAt, updatedAt.
 */
export function useOpportunity(id: string | undefined) {
  const { housingRegistry } = useContracts();

  const [data, setData] = useState<Opportunity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const numericId = id ? Number(id) : 1;

    setIsLoading(true);
    setError(null);
    (async () => {
      try {
        const op = await housingRegistry.getOpportunity(numericId);

        if (cancelled) return;

        // Parse "city, state" from addressLine like "960 Lawton St SW, Atlanta, GA"
        const addressLine: string = op.addressLine;
        const parts = addressLine.split(",").map((s) => s.trim());
        const street = parts[0] ?? addressLine;
        const city = parts[1] ?? "Atlanta";

        setData({
          id: numericId.toString(),
          rwaId: `RWA-${numericId.toString().padStart(3, "0")}`,
          address: street,
          city,
          neighborhood: op.neighborhood,
          status: STATUS_LABELS[Number(op.status)] ?? "Available",
          bedBath: "3 bed, 2 bath",
          sqft: 1326,
          targetPrice: Math.floor(Number(op.listPrice) / 100), // cents -> dollars
          affordability: `≤${op.amiTier.toString()}% AMI`,
          heroImage: FALLBACK_HERO,
        });
        setError(null);
      } catch (err: any) {
        console.error("useOpportunity error:", err);
        if (!cancelled) {
          setData(null);
          setError(err?.shortMessage ?? err?.message ?? String(err));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, housingRegistry, retryToken]);

  const retry = useCallback(() => setRetryToken((t) => t + 1), []);

  return { data, error, isLoading, retry };
}

export function useOpportunities() {
  const { data, error, isLoading, retry } = useOpportunity("1");
  return { data: data ? [data] : [], error, isLoading, retry };
}
