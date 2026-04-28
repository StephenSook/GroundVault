import { useCallback, useEffect, useState } from "react";
import { keccak256, toUtf8Bytes } from "ethers";

import { useContracts } from "@/hooks/useContracts";
import type { ImpactMemo } from "@/types";

const FALLBACK: ImpactMemo = {
  opportunityId: "1",
  title: "Impact Risk Memo · 960 Lawton St SW",
  preparedFor: "Prepared for the Community Land Trust Investment Committee.",
  sections: [
    {
      title: "1. Summary",
      body:
        "Memo not yet generated on chain. The MEMO_ROLE holder can publish a fresh ChainGPT impact memo via the regenerate button below; until then this fallback narrative is shown.",
    },
  ],
  provenance: {
    generator: "Pending",
    timestampUtc: "—",
    onChainHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    storageUri: "",
    verified: false,
  },
};

async function fetchMemoBody(memoUri: string, opportunityId: number): Promise<string | null> {
  // Both empty memoUri (live ChainGPT memo, body would be IPFS-pinned
  // in production) and the "fallback" sentinel (local fallback memo,
  // ChainGPT unavailable) mean the body lives in this client's
  // localStorage rather than at a fetchable URL. Memo.regenerate
  // writes to the unified key for both sources so the Provenance
  // panel can re-render the body and verify the keccak after a
  // refresh. Without this, real ChainGPT memos appear to vanish
  // post-refresh because the chain reader has no body to fetch.
  if (!memoUri || memoUri === "fallback") {
    try {
      const body = window.localStorage.getItem(`groundvault-memo-body:${opportunityId}`);
      if (body) return body;
    } catch {}
    // Backward-compat for fallback memos written before the unified
    // key existed. New writes go to groundvault-memo-body; reads
    // first try that key, then this legacy key, then give up.
    if (memoUri === "fallback") {
      try {
        return window.localStorage.getItem(`groundvault-fallback-memo:${opportunityId}`);
      } catch {
        return null;
      }
    }
    return null;
  }
  try {
    const url = memoUri.startsWith("ipfs://")
      ? memoUri.replace("ipfs://", "https://ipfs.io/ipfs/")
      : memoUri;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function parseMarkdownSections(markdown: string): ImpactMemo["sections"] {
  const blocks = markdown.split(/\n(?=#{1,3}\s)/g);
  return blocks
    .filter((b) => b.trim().length > 0)
    .map((block) => {
      const [first, ...rest] = block.split("\n");
      const title = first.replace(/^#{1,3}\s*/, "").trim();
      const body = rest.join("\n").trim();
      return { title, body };
    });
}

export function useImpactMemo(opportunityId: string | undefined) {
  const { housingRegistry } = useContracts();
  const [data, setData] = useState<ImpactMemo>(FALLBACK);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const numericId = opportunityId ? Number(opportunityId) : 1;

    setIsLoading(true);
    setError(null);
    (async () => {
      try {
        const op = await housingRegistry.getOpportunity(numericId);
        if (cancelled) return;

        const onChainHash: string = op.memoHash;
        const memoUri: string = op.memoUri;
        const isFallback = memoUri === "fallback";

        const body = await fetchMemoBody(memoUri, numericId);

        if (!body) {
          setData({
            ...FALLBACK,
            opportunityId: numericId.toString(),
            provenance: {
              generator: isFallback ? "Local fallback (ChainGPT unavailable)" : "Pending",
              timestampUtc: new Date(Number(op.updatedAt) * 1000).toISOString().replace("T", " ").slice(0, 19) + "Z",
              onChainHash,
              storageUri: memoUri,
              verified: false,
              isFallback,
            },
          });
          setError(null);
          return;
        }

        const computed = keccak256(toUtf8Bytes(body));
        const verified = computed.toLowerCase() === onChainHash.toLowerCase();

        const sections = parseMarkdownSections(body);

        setData({
          opportunityId: numericId.toString(),
          title: `Impact Risk Memo · ${op.addressLine}`,
          preparedFor: "Prepared for the GroundVault investment committee.",
          sections: sections.length > 0 ? sections : [{ title: "Memo body", body }],
          provenance: {
            generator: isFallback ? "Local fallback (ChainGPT unavailable)" : "ChainGPT Web3 LLM",
            timestampUtc:
              new Date(Number(op.updatedAt) * 1000).toISOString().replace("T", " ").slice(0, 19) + "Z",
            onChainHash,
            storageUri: memoUri,
            verified,
            isFallback,
          },
        });
        setError(null);
      } catch (err: any) {
        console.error("useImpactMemo error:", err);
        if (!cancelled) {
          setData({ ...FALLBACK, opportunityId: (opportunityId ?? "1") });
          setError(err?.shortMessage ?? err?.message ?? String(err));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [opportunityId, housingRegistry, retryToken]);

  const retry = useCallback(() => setRetryToken((t) => t + 1), []);

  return { data, error, isLoading, retry };
}
