import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { Relayer, prisma } from "./queue.js";

let running = true;
let intervalId: ReturnType<typeof setInterval> | null = null;

async function main() {
  logger.info("🚀 StellarPay relayer starting");
  const r = new Relayer();
  const tick = async () => {
    if (!running) return;
    try {
      await r.processOnce();
    } catch (err) {
      logger.error({ err }, "relayer tick failed");
    }
  };
  await tick();
  intervalId = setInterval(tick, config.POLL_INTERVAL_MS);

  // H9 FIX: Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "relayer shutting down...");
    running = false;
    if (intervalId) clearInterval(intervalId);
    await new Promise((r) => setTimeout(r, 5_000));
    await prisma.$disconnect();
    logger.info("relayer shut down cleanly");
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "fatal");
  process.exit(1);
});
