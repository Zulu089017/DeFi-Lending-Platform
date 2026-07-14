import { prisma } from "../../db.js";

let _idCounter = 0;
let _txCounter = 0;
function nextId(): string {
  return `evt_${Date.now()}_${++_idCounter}`;
}
function nextTxHash(): string {
  _txCounter += 1;
  return `0x${_txCounter.toString(16).padStart(64, "0")}`;
}

export type LendingEventType = "supply" | "borrow" | "repay" | "withdraw";

export interface SeedLendingEventOpts {
  type: LendingEventType;
  user: string;
  asset: string;
  amount: bigint;
  logIndex?: number;
  createdAt?: Date;
}

/**
 * Insert a single `LendingEvent` row. The `id` and `(txHash, logIndex)`
 * unique constraints are satisfied by monotonic counters. `amount` is
 * stored as `BigInt` so callers can pass amounts > 2^53.
 */
export function seedLendingEvent(opts: SeedLendingEventOpts) {
  return prisma.lendingEvent.create({
    data: {
      id: nextId(),
      txHash: nextTxHash(),
      logIndex: opts.logIndex ?? 0,
      type: opts.type,
      user: opts.user,
      asset: opts.asset,
      amount: opts.amount,
      createdAt: opts.createdAt ?? new Date(),
    },
  });
}
