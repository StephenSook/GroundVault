import { useEffect, useState } from "react";
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

async function fetchMemoBody(memoUri: string): Promise<string | null> {
  if (!memoUri) return null;
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const numericId = opportunityId ? Number(opportunityId) : 1;

    setIsLoading(true);
    (async () => {
      try {
        const op = await housingRegistry.getOpportunity(numericId);
        if (cancelled) return;

        const onChainHash: string = op.memoHash;
        const memoUri: string = op.memoUri;

        const body = await fetchMemoBody(memoUri);

        if (!body) {
          setData({
            ...FALLBACK,
            opportunityId: numericId.toString(),
            provenance: {
              generator: "Pending",
              timestampUtc: new Date(Number(op.updatedAt) * 1000).toISOString().replace("T", " ").slice(0, 19) + "Z",
              onChainHash,
              storageUri: memoUri,
              verified: false,
            },
          });
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
            generator: "ChainGPT Web3 LLM",
            timestampUtc:
              new Date(Number(op.updatedAt) * 1000).toISOString().replace("T", " ").slice(0, 19) + "Z",
            onChainHash,
            storageUri: memoUri,
            verified,
          },
        });
      } catch (err) {
        console.error("useImpactMemo error:", err);
        if (!cancelled) setData({ ...FALLBACK, opportunityId: (opportunityId ?? "1") });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [opportunityId, housingRegistry]);

  return { data, isLoading };
}
