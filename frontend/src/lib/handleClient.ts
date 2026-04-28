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

// Errors that ARE worth retrying — the Nox testnet's secret-store API
// occasionally rejects requests with "Network request failed" / 5xx /
// timeout while the underlying ACL + handle are perfectly fine. A
// 200ms-backoff retry generally clears these on the second try.
const TRANSIENT_PATTERNS: readonly RegExp[] = [
  /network request failed/i,
  /timeout/i,
  /timed out/i,
  /econn(refused|reset|aborted)/i,
  /socket hang up/i,
  /fetch failed/i,
  /\b(502|503|504)\b/,
];

// Errors that are NOT worth retrying — these reflect a real ACL /
// handle / auth problem and another attempt would just burn time
// before failing identically.
const PERMANENT_PATTERNS: readonly RegExp[] = [
  /unauthorized/i,
  /forbidden/i,
  /\bacl\b/i,
  /permission denied/i,
  /malformed/i,
  /invalid handle/i,
  /\b401\b/,
  /\b403\b/,
  /\b404\b/,
];

function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (PERMANENT_PATTERNS.some((p) => p.test(msg))) return false;
  if (TRANSIENT_PATTERNS.some((p) => p.test(msg))) return true;
  // Default: fail fast on unclassified errors. The previous default
  // was retry-on-unknown, but that burned hundreds of ms per failed
  // call when the SDK introduced a new error shape we hadn't matched
  // yet. The known-transient list covers the actual Nox testnet
  // flakiness (network/timeout/5xx). Anything else surfaces in the UI
  // immediately so the user can see what's wrong.
  return false;
}

async function withRetry<T>(
  op: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 200,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || i === attempts - 1) throw err;
      // Sleeps between attempts: 200ms (after attempt 0) and 600ms
      // (after attempt 1). The third attempt (i === 2) hits the
      // attempts-1 guard above and throws without sleeping. So total
      // added latency on a worst-case all-three-fail path is
      // 200 + 600 = 800ms.
      const delay = baseDelayMs * Math.pow(3, i);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
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
  // Real handles go through the Nox TEE with retry-on-transient. A
  // failure that survives all retries indicates a genuine ACL / TEE
  // problem; the caller's per-handle try/catch surfaces it inline.
  const result = await withRetry(() => client.decrypt(handle as `0x${string}`));
  return result.value as bigint;
}

export async function encryptUint256(
  client: HandleSdk,
  value: bigint,
  applicationContract: `0x${string}`,
): Promise<{ handle: `0x${string}`; handleProof: `0x${string}` }> {
  // Same retry policy applies here — encryptInput hits the same Nox
  // testnet that flakes on decrypt, and a transient failure during a
  // wrap or recordDeposit would force the user to restart the whole
  // multi-tx flow.
  const result = await withRetry(() =>
    client.encryptInput(value, "uint256", applicationContract),
  );
  return { handle: result.handle as `0x${string}`, handleProof: result.handleProof };
}
