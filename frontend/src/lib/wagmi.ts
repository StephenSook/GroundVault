import { http, createConfig } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia],
  connectors: [injected()],
  transports: {
    // Pin the public Arbitrum Sepolia RPC explicitly. Without an explicit
    // URL wagmi would derive a transport from the chain object's default
    // HTTP list, which is rate-limited and unreliable under demo load
    // (judges hitting the deployed Vercel preview at the same time). The
    // URL matches FALLBACK_RPC in useContracts so write and read paths
    // share the same endpoint.
    [arbitrumSepolia.id]: http("https://sepolia-rollup.arbitrum.io/rpc"),
  },
  ssr: false,
});

export const ARB_SEPOLIA_ID = arbitrumSepolia.id;
