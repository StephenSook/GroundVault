// Real @iexec-nox/handle SDK wrapper.
//
// - On client-side, encryptInput(value, "uint256", applicationContract)
//   returns { handle, handleProof } that gets passed to confidential
//   contract calls.
// - decrypt(handle) returns { value, solidityType } via TEE roundtrip
//   for handles ACL-allowed to the connected wallet.

import { createEthersHandleClient } from "@iexec-nox/handle";
import type { Signer } from "ethers";

export type HandleSdk = Awaited<ReturnType<typeof createEthersHandleClient>>;

export async function buildHandleClient(signer: Signer): Promise<HandleSdk> {
  return createEthersHandleClient(signer);
}

export interface DecryptedValue {
  value: bigint;
  solidityType: string;
}

export async function decryptUint256(
  client: HandleSdk,
  handle: string,
): Promise<bigint> {
  // Default-zero handle: the chain's encrypted-zero reference is the
  // same bytes for every uninitialised slot, and we know the value is
  // 0 without going to the TEE. This short-circuit is safe and
  // expected — the UI renders "0.00 cUSDC" rather than "—".
  if (!handle || handle === "0x" || /^0x0+$/.test(handle)) return 0n;
  // Real handles go through the Nox TEE. Errors from this path are
  // not silent-zero — they indicate the wallet's ACL was rejected,
  // the TEE timed out, or the handle is malformed. Surface as a
  // throw so the caller's per-handle try/catch can render the
  // failure inline instead of treating "decrypt failed" as "value
  // is zero".
  const result = await client.decrypt(handle as `0x${string}`);
  return result.value as bigint;
}

export async function encryptUint256(
  client: HandleSdk,
  value: bigint,
  applicationContract: `0x${string}`,
): Promise<{ handle: `0x${string}`; handleProof: `0x${string}` }> {
  const result = await client.encryptInput(value, "uint256", applicationContract);
  return { handle: result.handle as `0x${string}`, handleProof: result.handleProof };
}
