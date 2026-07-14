import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { Relayer } from "./queue.js";

async function main() {
  logger.info("🚀 OpenLend relayer starting");
  const r = new Relayer();
  const tick = async () => {
    try {
      await r.processOnce();
    } catch (err) {
      logger.error({ err }, "relayer tick failed");
    }
  };
  await tick();
  setInterval(tick, config.POLL_INTERVAL_MS);
}

main().catch((err) => {
  logger.fatal({ err }, "fatal");
  process.exit(1);
});
