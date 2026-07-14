import {
  Horizon,
  Keypair,
  TransactionBuilder,
  Operation,
  nativeToScVal,
  Address as ScAddress,
  xdr,
} from "@stellar/stellar-sdk";
import { ethers } from "ethers";
import { config } from "../config.js";
import { markMinted, prisma } from "../store/db.js";
import { collectSignatures, payloadHash } from "../attest/signer.js";
import type { StellarMintRequest, SourceEvent } from "../types.js";
import { logger } from "../utils/logger.js";

const CHAIN_IDS = { ethereum: 1, polygon: 137, solana: 0 } as const;

// NOTE: The on-chain `lending_controller.wrap` expects a single ed25519
// signature (`BytesN<64>`) over a payload that binds (chain_id, source_addr,
// amount, to, salt). The off-chain attester set must therefore use ed25519
// keys (the same curve Soroban uses natively), not ECDSA. The signer below
// is wired to produce ed25519 signatures; see `attest/signer.ts`.

export class StellarMinter {
  private server: Horizon.Server;
  private keypair: Keypair;
  private controller: string;
  private network: string;

  constructor() {
    this.server = new Horizon.Server(config.STELLAR_RPC);
    this.keypair = Keypair.fromSecret(config.RELAYER_SECRET);
    this.controller = config.STELLAR_CONTROLLER;
    this.network = config.STELLAR_NETWORK_PASSPHRASE;
  }

  /** Queue a mint request from a SourceEvent. */
  async enqueue(ev: SourceEvent, stellarDest: string): Promise<void> {
    await prisma.mintRequest.upsert({
      where: { sourceTx_sourceLogIndex: { sourceTx: ev.txHash, sourceLogIndex: ev.logIndex } },
      create: {
        chain: ev.chain,
        sourceTx: ev.txHash,
        sourceLogIndex: ev.logIndex,
        sourceAddress: ev.token,
        amount: ev.amount,
        to: stellarDest,
        salt: ev.salt,
        status: "pending",
      },
      update: {},
    });
  }

  /** Process pending mint requests. */
  async processPending(): Promise<{ minted: number; failed: number }> {
    const pending = await prisma.mintRequest.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      take: 25,
    });

    let minted = 0;
    let failed = 0;

    for (const req of pending) {
      try {
        const req_typed: StellarMintRequest = {
          chain: req.chain as "ethereum" | "polygon" | "solana",
          sourceTx: req.sourceTx,
          sourceLogIndex: req.sourceLogIndex,
          sourceAddress: req.sourceAddress,
          amount: req.amount,
          to: req.to,
          salt: req.salt,
        };
        const ok = await this.mint(req_typed);
        if (ok) minted++;
        else failed++;
      } catch (err) {
        logger.error({ err, req }, "mint failed");
        failed++;
      }
    }

    return { minted, failed };
  }

  /** Submit the `wrap` call to the Soroban controller. */
  async mint(req: StellarMintRequest): Promise<boolean> {
    const chainId = CHAIN_IDS[req.chain];
    // Per-event nonce: take the lower 64 bits of keccak256(sourceTx || logIndex)
    // so every source event produces a unique, deterministic nonce that fits
    // in a u64 and cannot be predicted by a same-source attacker.
    const nonceHash = ethers.keccak256(
      ethers.solidityPacked(
        ["bytes32", "uint256"],
        [req.sourceTx, req.sourceLogIndex],
      ),
    );
    const nonce = BigInt(nonceHash) & 0xffffffffffffffffn;
    const payload = payloadHash({
      chainId,
      sourceToken: req.sourceAddress,
      amount: req.amount,
      stellarDest: req.to,
      salt: req.salt,
      nonce,
    });
    const sigs = await collectSignatures(payload);
    if (sigs.length === 0) {
      logger.error("no signatures collected");
      return false;
    }

    // The on-chain controller verifies a single ed25519 signature from the
    // bridge attester set. We pack the first collected signature as BytesN<64>.
    const firstSig = sigs[0];
    const sigBytes = Buffer.from(firstSig.replace(/^0x/, ""), "hex");
    if (sigBytes.length !== 64) {
      logger.error({ len: sigBytes.length }, "unexpected signature length");
      return false;
    }
    const saltBytes = Buffer.from(req.salt.replace(/^0x/, ""), "hex");
    if (saltBytes.length !== 32) {
      logger.error({ len: saltBytes.length }, "salt must be 32 bytes");
      return false;
    }

    // Build Soroban invocation of `lending_controller.wrap`. We use the XDR
    // constructor directly for the BytesN fields because `nativeToScVal` with
    // `type: "bytes"` produces a variable-length Bytes which the Soroban
    // host will reject for a BytesN<64> / BytesN<32> parameter.
    const sigScval = xdr.ScVal.scvBytesN(sigBytes);
    const saltScval = xdr.ScVal.scvBytesN(saltBytes);
    const nonceU64 = nativeToScVal(nonce, { type: "u64" });

    // sourceAddress is now a 32-byte BytesN<32> on-chain. Accept either
    // a 32-byte hex string (with or without 0x) or an ASCII string padded
    // to 32 bytes.
    const saHex = req.sourceAddress.startsWith("0x")
      ? req.sourceAddress.slice(2)
      : req.sourceAddress;
    let sourceAddrBytes: Buffer;
    if (/^[0-9a-fA-F]{64}$/.test(saHex)) {
      sourceAddrBytes = Buffer.from(saHex, "hex");
    } else {
      sourceAddrBytes = Buffer.alloc(32);
      Buffer.from(req.sourceAddress, "ascii")
        .subarray(0, 32)
        .copy(sourceAddrBytes);
    }
    const sourceAddrScval = xdr.ScVal.scvBytesN(sourceAddrBytes);

    const source = await this.server.loadAccount(this.keypair.publicKey());
    const tx = new TransactionBuilder(source, {
      fee: "100000",
      networkPassphrase: this.network,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract: this.controller,
          function: "wrap",
          args: [
            sigScval,
            nativeToScVal(chainId, { type: "u32" }),
            sourceAddrScval,
            nativeToScVal(req.amount, { type: "i128" }),
            ScAddress.fromString(req.to).toScVal(),
            saltScval,
            nonceU64,
          ],
        }) as any,
      )
      .setTimeout(60)
      .build();

    try {
      const result = await this.server.submitTransaction(tx);
      await markMinted(req.sourceTx, req.sourceLogIndex, result.hash);
      logger.info({ tx: result.hash, sourceTx: req.sourceTx }, "minted wTKN on Stellar");
      return true;
    } catch (err) {
      logger.error({ err, sourceTx: req.sourceTx }, "submit failed");
      return false;
    }
  }
}
