import "dotenv/config";
import { z } from "zod";

const Env = z.object({
  ETHEREUM_RPC: z.string().url(),
  POLYGON_RPC: z.string().url(),
  SOLANA_RPC: z.string().url(),

  ETHEREUM_BRIDGE: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  POLYGON_BRIDGE: z.string().regex(/^0x[a-fA-F0-9]{40}$/),

  STELLAR_RPC: z.string().url(),
  STELLAR_NETWORK_PASSPHRASE: z.string(),
  STELLAR_CONTROLLER: z.string(),
  RELAYER_SECRET: z.string(),

  ATTESTER_KEYS: z.string(),
  ATTESTER_THRESHOLD: z.coerce.number().int().positive(),

  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(4_000),
  PORT: z.coerce.number().int().positive().default(4100),
});

export const config = Env.parse(process.env);

export const attesters = config.ATTESTER_KEYS.split(",").map((s) => s.trim());
