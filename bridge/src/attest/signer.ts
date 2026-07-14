import * as ed from "@noble/ed25519";
import { createHash } from "crypto";
import { ethers } from "ethers";
import { Address as ScAddress } from "@stellar/stellar-sdk";
import { attesters, config } from "../config.js";
import { logger } from "../utils/logger.js";

/**
 * Canonical payload format (must match `build_canonical_payload` in
 * stellar-contracts/contracts/lending_controller/src/lib.rs).
 *
 * Layout (dynamic, appended in order):
 *   1. "OWRP" (4 ASCII bytes)
 *   2. chain_id (u32 LE)
 *   3. source_addr (32 raw bytes)
 *   4. amount (i64 LE)
 *   5. to: full ScVal XDR of the Address (40 bytes for an ed25519 account)
 *   6. salt (32 raw bytes)
 *   7. nonce (u64 LE)
 *
 * The on-chain side uses `to.to_xdr(env)` to serialize the Address. The
 * off-chain side must use the exact same XDR — we get it via
 * `ScAddress.fromString(...).toScVal().toXDR()`. We then sha256(payload)
 * and ed25519-sign the 32-byte digest. Soroban has `env.crypto().sha256`
 * and `env.crypto().ed25519_verify` but NOT keccak256.
 */
export function payloadHash(args: {
  chainId: number;
  sourceToken: string;
  amount: bigint;
  stellarDest: string; // Strkey "G..."
  salt: string;       // 32-byte hex with or without 0x
  nonce: bigint;
}): Uint8Array {
  const bufs: Buffer[] = [];
  // 1. tag
  bufs.push(Buffer.from("OWRP", "ascii"));
  // 2. chain_id (u32 LE)
  const cid = Buffer.alloc(4);
  cid.writeUInt32LE(args.chainId >>> 0);
  bufs.push(cid);
  // 3. source_addr (32 raw bytes)
  const saHex = args.sourceToken.startsWith("0x")
    ? args.sourceToken.slice(2)
    : args.sourceToken;
  let sa: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(saHex)) {
    sa = Buffer.from(saHex, "hex");
  } else {
    sa = Buffer.alloc(32);
    Buffer.from(args.sourceToken, "ascii").subarray(0, 32).copy(sa);
  }
  bufs.push(sa);
  // 4. amount (i64 LE) — clamp to i64 range
  const amt = Buffer.alloc(8);
  amt.writeBigInt64LE(BigInt.asIntN(64, args.amount));
  bufs.push(amt);
  // 5. to: full ScVal XDR of the Address
  const toScVal = ScAddress.fromString(args.stellarDest).toScVal();
  const toXdr = Buffer.from(toScVal.toXDR());
  // Mirror the on-chain sanity check: an ed25519 Address serializes to
  // exactly 40 bytes. If this ever changes, the on-chain assertion in
  // `build_canonical_payload` will catch it — but failing fast at signing
  // time is much cheaper than reverting at mint time.
  if (toXdr.length !== 40) {
    throw new Error(`expected 40-byte Address XDR, got ${toXdr.length}`);
  }
  bufs.push(toXdr);
  // 6. salt (32 raw bytes)
  const saltHex = args.salt.replace(/^0x/, "");
  if (saltHex.length !== 64) {
    throw new Error(`salt must be 32 bytes (64 hex chars), got ${saltHex.length}`);
  }
  bufs.push(Buffer.from(saltHex, "hex"));
  // 7. nonce (u64 LE)
  const nonce = Buffer.alloc(8);
  nonce.writeBigUInt64LE(BigInt.asUintN(64, args.nonce));
  bufs.push(nonce);

  const payload = Buffer.concat(bufs);
  return new Uint8Array(createHash("sha256").update(payload).digest());
}

/** Sign the payload with each attester's ed25519 secret key, collecting
 *  up to `ATTESTER_THRESHOLD` signatures. Returns the signatures as
 *  hex strings (64 bytes each) ready to be packed into a `BytesN<64>`
 *  Soroban argument by the on-chain wrapper. */
export async function collectSignatures(payload: Uint8Array): Promise<string[]> {
  const sigs: string[] = [];
  for (const pk of attesters) {
    try {
      const secretKey = Buffer.from(pk.replace(/^0x/, ""), "hex");
      if (secretKey.length !== 32) throw new Error("ed25519 secret must be 32 bytes");
      const sig = await ed.sign(payload, secretKey);
      sigs.push("0x" + Buffer.from(sig).toString("hex"));
      if (sigs.length >= config.ATTESTER_THRESHOLD) break;
    } catch (err) {
      logger.error({ err }, "attester failed to sign");
    }
  }
  return sigs;
}
