import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";
import { ARB_SEPOLIA_ID } from "@/lib/wagmi";

/**
 * Demo bypass: when ?wallet=mock is in the URL AND VITE_ALLOW_DEMO_BYPASSES=1
 * is set at build time, simulate a connected wallet so the design states
 * are demoable without a real extension. The build-time gate keeps a
 * hardened production build out of mock-wallet mode regardless of URL.
 */
function useMockWallet() {
  if (typeof window === "undefined") return null;
  if (import.meta.env.VITE_ALLOW_DEMO_BYPASSES !== "1") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("wallet") === "mock") {
    return {
      address: "0x9Fba1234567890abcdef1234567890abcdef6f15" as `0x${string}`,
      chainId: ARB_SEPOLIA_ID,
    };
  }
  return null;
}

export function useWallet() {
  const account = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const mock = useMockWallet();

  const address = mock?.address ?? account.address;
  const isConnected = Boolean(mock) || account.isConnected;
  const effectiveChainId = mock?.chainId ?? chainId;
  const isOnArbSepolia = effectiveChainId === ARB_SEPOLIA_ID;

  return {
    address,
    isConnected,
    isConnecting,
    isOnArbSepolia,
    chainId: effectiveChainId,
    connect: () => {
      const injected = connectors.find((c) => c.type === "injected") ?? connectors[0];
      if (injected) connect({ connector: injected });
    },
    disconnect,
  };
}

export function shortAddress(addr?: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
