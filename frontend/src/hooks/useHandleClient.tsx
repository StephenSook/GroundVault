import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BrowserProvider, type Signer } from "ethers";
import { useWalletClient } from "wagmi";

import {
  buildHandleClient,
  decryptUint256,
  encryptUint256,
  type HandleSdk,
} from "@/lib/handleClient";

interface HandleClientCtx {
  sdk: HandleSdk | null;
  signer: Signer | null;
  decryptUint256: (handle: string) => Promise<bigint | null>;
  encryptUint256: (
    value: bigint,
    applicationContract: `0x${string}`,
  ) => Promise<{ handle: `0x${string}`; handleProof: `0x${string}` }>;
}

const HandleClientContext = createContext<HandleClientCtx | null>(null);

/**
 * Builds an ethers v6 Signer from the wagmi v2 wallet client. Required
 * because @iexec-nox/handle needs an ethers Signer to sign encryption +
 * decryption envelopes; viem's WalletClient is not directly compatible.
 */
function useEthersSigner(): Signer | null {
  const { data: walletClient } = useWalletClient();
  const [signer, setSigner] = useState<Signer | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!walletClient) {
      setSigner(null);
      return;
    }
    const provider = new BrowserProvider(walletClient.transport, {
      chainId: walletClient.chain.id,
      name: walletClient.chain.name,
    });
    provider
      .getSigner(walletClient.account.address)
      .then((s) => {
        if (!cancelled) setSigner(s);
      })
      .catch(() => {
        if (!cancelled) setSigner(null);
      });
    return () => {
      cancelled = true;
    };
  }, [walletClient]);

  return signer;
}

export function HandleClientProvider({ children }: { children: ReactNode }) {
  const signer = useEthersSigner();
  const [sdk, setSdk] = useState<HandleSdk | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!signer) {
      setSdk(null);
      return;
    }
    buildHandleClient(signer)
      .then((client) => {
        if (!cancelled) setSdk(client);
      })
      .catch((err) => {
        console.error("Failed to build handle SDK", err);
        if (!cancelled) setSdk(null);
      });
    return () => {
      cancelled = true;
    };
  }, [signer]);

  const value = useMemo<HandleClientCtx>(
    () => ({
      sdk,
      signer,
      decryptUint256: async (handle: string) => {
        if (!sdk) return null;
        return decryptUint256(sdk, handle);
      },
      encryptUint256: async (value: bigint, applicationContract: `0x${string}`) => {
        if (!sdk) throw new Error("Handle SDK not initialised — connect wallet first");
        return encryptUint256(sdk, value, applicationContract);
      },
    }),
    [sdk, signer],
  );

  return (
    <HandleClientContext.Provider value={value}>{children}</HandleClientContext.Provider>
  );
}

export function useHandleClient(): HandleClientCtx {
  const ctx = useContext(HandleClientContext);
  if (!ctx) throw new Error("useHandleClient must be used within HandleClientProvider");
  return ctx;
}
