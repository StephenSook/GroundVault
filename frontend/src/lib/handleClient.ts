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
): Promise<bigint | null> {
  if (!handle || handle === "0x" || /^0x0+$/.test(handle)) return 0n;
  try {
    const result = await client.decrypt(handle as `0x${string}`);
    return result.value as bigint;
  } catch {
    return null;
  }
}

export async function encryptUint256(
  client: HandleSdk,
  value: bigint,
  applicationContract: `0x${string}`,
): Promise<{ handle: `0x${string}`; handleProof: `0x${string}` }> {
  const result = await client.encryptInput(value, "uint256", applicationContract);
  return { handle: result.handle as `0x${string}`, handleProof: result.handleProof };
}
