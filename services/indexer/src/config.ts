import "dotenv/config";
import { z } from "zod";

const Env = z.object({
  DATABASE_URL: z.string().url(),
  STELLAR_RPC: z.string().url(),
  STELLAR_NETWORK_PASSPHRASE: z.string(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5_000),
  PORT: z.coerce.number().int().positive().default(4200),
});

export const config = Env.parse(process.env);
