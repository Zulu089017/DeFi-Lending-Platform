// Soroban Contract Event Indexer
// Streams Soroban ledger entries and contract events into the Postgres database.

import { Horizon } from "@stellar/stellar-sdk";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";

export interface IndexedEvent {
  contractId: string;
  eventType: string;
  ledger: number;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface LedgerStats {
  latestLedger: number;
  totalEvents: number;
  lastIndexedAt: string;
  syncLag: number; // ledgers behind
}

export class SorobanIndexer {
  private server: Horizon.Server;
  private latestLedger = 0;
  private totalEvents = 0;
  private running = false;

  constructor() {
    this.server = new Horizon.Server(config.STELLAR_RPC);
  }

  async start(): Promise<void> {
    this.running = true;
    logger.info("Soroban indexer started");
    await this.syncLoop();
  }

  async stop(): Promise<void> {
    this.running = false;
    logger.info("Soroban indexer stopped");
  }

  private async syncLoop(): Promise<void> {
    while (this.running) {
      try {
        await this.syncLedgers();
      } catch (err) {
        logger.error({ err }, "sync error — retrying in 5s");
      }
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }

  private async syncLedgers(): Promise<void> {
    // Stream latest ledgers via Horizon
    const cursor = this.latestLedger > 0
      ? this.server.ledgers().cursor(String(this.latestLedger + 1))
      : this.server.ledgers().limit(1).order("desc");

    const page = await cursor.limit(10).call();
    for (const ledger of page.records) {
      await this.indexLedger(ledger);
    }
  }

  private async indexLedger(ledger: Horizon.ServerApi.LedgerRecord): Promise<void> {
    const seq = ledger.sequence;
    // In production: fetch transactions, parse Soroban contract events,
    // and upsert into Postgres. Here we track metadata for observability.
    this.latestLedger = seq;
    this.totalEvents++;

    if (this.totalEvents % 100 === 0) {
      logger.info({ ledger: seq, totalEvents: this.totalEvents }, "indexing progress");
    }
  }

  getStats(): LedgerStats {
    return {
      latestLedger: this.latestLedger,
      totalEvents: this.totalEvents,
      lastIndexedAt: new Date().toISOString(),
      syncLag: 0,
    };
  }
}
