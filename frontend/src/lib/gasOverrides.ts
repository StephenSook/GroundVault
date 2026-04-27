// Fetches current Arbitrum Sepolia fee data and returns ethers tx
// overrides with `maxFeePerGas` padded 2× above the network estimate.
// Without this pad, a chain write submitted with the snapshot
// maxFeePerGas can fail at submit time with:
//
//   "max fee per gas less than block base fee:
//      maxFeePerGas: 20000000 baseFee: 20020000"
//
// even when the gap is trivial (here, 20_000 wei / 0.0001 gwei). The
// chain rejects the tx outright before it touches the contract, and
// the failure surfaces in the UI as a generic "could not coalesce
// error" toast that masks the real cause. The 2× pad survives normal
// base-fee drift between estimation and inclusion.

import { JsonRpcProvider } from "ethers";

const RPC = "https://sepolia-rollup.arbitrum.io/rpc";
const feeProvider = new JsonRpcProvider(RPC);

const DEFAULT_PRIORITY_FEE = 1_000_000n; // 0.001 gwei

export interface GasOverrides {
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

export async function bumpedGasOverrides(): Promise<GasOverrides> {
  try {
    const feeData = await feeProvider.getFeeData();
    if (!feeData.maxFeePerGas) return {};
    return {
      maxFeePerGas: feeData.maxFeePerGas * 2n,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? DEFAULT_PRIORITY_FEE,
    };
  } catch {
    // Fall back to "no overrides" — the wallet's own estimator gets a
    // chance, which usually works at the cost of occasional rejections
    // like the one this helper is here to prevent.
    return {};
  }
}
