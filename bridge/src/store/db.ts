import { PrismaClient } from "@prisma/client";
import type { SourceEvent, StellarMintRequest, UnwrapEvent } from "../types.js";

export const prisma = new PrismaClient();

/** Record a source-chain event. Idempotent on (chain, txHash, logIndex). */
export async function saveEvent(ev: SourceEvent): Promise<void> {
  await prisma.sourceEvent.upsert({
    where: {
      chain_txHash_logIndex: { chain: ev.chain, txHash: ev.txHash, logIndex: ev.logIndex },
    },
    create: {
      chain: ev.chain,
      txHash: ev.txHash,
      logIndex: ev.logIndex,
      blockNumber: BigInt(ev.blockNumber),
      sender: ev.sender,
      token: ev.token,
      amount: ev.amount,
      stellarDest: ev.stellarDest,
      salt: ev.salt,
      nonce: ev.nonce,
    },
    update: {},
  });
}

export async function listPendingMints(): Promise<StellarMintRequest[]> {
  const rows = await prisma.mintRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  return rows.map((r) => ({
    chain: r.chain as "ethereum" | "polygon" | "solana",
    sourceTx: r.sourceTx,
    sourceLogIndex: r.sourceLogIndex,
    sourceAddress: r.sourceAddress,
    amount: r.amount,
    to: r.to,
    salt: r.salt,
  }));
}

export async function markMinted(
  sourceTx: string,
  sourceLogIndex: number,
  stellarTxHash: string,
): Promise<void> {
  await prisma.mintRequest.update({
    where: { sourceTx_sourceLogIndex: { sourceTx, sourceLogIndex } },
    data: { status: "minted", stellarTxHash },
  });
}

export async function saveUnwrap(ev: UnwrapEvent): Promise<void> {
  await prisma.unwrapEvent.upsert({
    where: { txHash: ev.txHash },
    create: {
      chain: ev.chain,
      txHash: ev.txHash,
      user: ev.user,
      amount: ev.amount,
      sourceChain: ev.sourceChain,
      sourceAddr: ev.sourceAddr,
      nonce: ev.nonce,
    },
    update: {},
  });
}
