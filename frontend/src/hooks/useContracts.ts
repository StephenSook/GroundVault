import { useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, JsonRpcProvider, type Signer } from "ethers";
import { useWalletClient } from "wagmi";

import { ABIS, DEPLOYMENT, type ContractName } from "@/lib/contracts";

const FALLBACK_RPC = "https://sepolia-rollup.arbitrum.io/rpc";

/**
 * Returns ethers Contract instances for every GroundVault production
 * contract. When a wallet is connected, contracts are bound to the wallet
 * signer (write access); otherwise they are bound to a public RPC provider
 * (read-only). The Identity contract is per-investor and is built ad-hoc
 * via {makeIdentityContract} on the verify flow rather than appearing in
 * this fixed lookup.
 */
export function useContracts() {
  const { data: walletClient } = useWalletClient();
  const [signer, setSigner] = useState<Signer | null>(null);
  const [signerError, setSignerError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!walletClient) {
      setSigner(null);
      setSignerError(null);
      return;
    }
    setSignerError(null);
    const provider = new BrowserProvider(walletClient.transport, {
      chainId: walletClient.chain.id,
      name: walletClient.chain.name,
    });
    provider
      .getSigner(walletClient.account.address)
      .then((s) => {
        if (!cancelled) {
          setSigner(s);
          setSignerError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSigner(null);
          setSignerError(err?.shortMessage ?? err?.message ?? String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [walletClient]);

  return useMemo(() => {
    const runner = signer ?? new JsonRpcProvider(FALLBACK_RPC);
    const make = (name: ContractName) =>
      new Contract(DEPLOYMENT.contracts[name].address, ABIS[name] as any, runner);

    return {
      claimTopicsRegistry: make("ClaimTopicsRegistry"),
      trustedIssuersRegistry: make("TrustedIssuersRegistry"),
      identityRegistry: make("IdentityRegistry"),
      modularCompliance: make("ModularCompliance"),
      jurisdictionModule: make("JurisdictionModule"),
      mockUsdc: make("MockUSDC"),
      cusdc: make("cUSDC"),
      shareToken: make("GroundVaultToken"),
      vault: make("GroundVaultCore"),
      housingRegistry: make("GroundVaultRegistry"),
      router: make("GroundVaultRouter"),
      signer,
      signerError,
      // True when contracts can sign + send transactions. False means
      // every contract is bound to the read-only fallback RPC and any
      // write call (mint, approve, wrap, confidentialTransfer,
      // recordDeposit, processDeposit, claimDeposit, setMemo) will
      // throw before reaching the chain.
      hasSigner: signer !== null,
    };
  }, [signer, signerError]);
}
