import { Connection, PublicKey } from "@solana/web3.js";
import { config } from "../config.js";
import { saveEvent, prisma } from "../store/db.js";
import type { SourceEvent } from "../types.js";
import { logger } from "../utils/logger.js";

const POLLER_NAME = "solana";

/** In a real implementation, the bridge is an Anchor program; we'd parse
 *  anchor events. This scaffold fetches transaction signatures and assumes
 *  the off-chain indexer stores the parsed events. */
export class SolanaWatcher {
  private conn: Connection;
  private bridge: PublicKey;
  private lastSlot: number | null = null;

  constructor() {
    this.conn = new Connection(config.SOLANA_RPC, "confirmed");
    // TBD: replace with the deployed bridge program id
    this.bridge = new PublicKey("11111111111111111111111111111111");
  }

  async pollOnce(): Promise<SourceEvent[]> {
    const head = await this.conn.getSlot();
    const from = (this.lastSlot ?? head - 50) + 1;
    if (from > head) return [];

    const sigs = await this.conn.getSignaturesForAddress(this.bridge, { min: from, limit: 100 });
    const events: SourceEvent[] = [];
    for (const s of sigs) {
      // For the scaffold we just record the signature; the real implementation
      // would decode the Anchor event into a SourceEvent.
      logger.debug({ sig: s.signature, slot: s.slot }, "solana bridge tx");
    }
    this.lastSlot = head;
    await prisma.cursor.upsert({
      where: { chain: POLLER_NAME },
      create: { chain: POLLER_NAME, block: BigInt(head) },
      update: { block: BigInt(head) },
    });
    return events;
  }

  async start() {
    this.lastSlot = await this.getLastSlotFromDb();
    logger.info({ from: this.lastSlot }, "solana watcher starting");
  }

  async getLastSlotFromDb(): Promise<number | null> {
    const c = await prisma.cursor.findUnique({ where: { chain: POLLER_NAME } });
    return c ? Number(c.block) : null;
  }
}
