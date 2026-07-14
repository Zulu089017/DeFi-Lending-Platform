import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { EthereumWatcher } from "./chains/ethereum.js";
import { PolygonWatcher } from "./chains/polygon.js";
import { SolanaWatcher } from "./chains/solana.js";
import { StellarWatcher } from "./chains/stellar.js";
import { StellarMinter } from "./mint/stellarMinter.js";

async function main() {
  logger.info("🚀 OpenLend bridge starting");

  const eth = new EthereumWatcher();
  const poly = new PolygonWatcher();
  const sol = new SolanaWatcher();
  const stellarW = new StellarWatcher();
  const minter = new StellarMinter();

  await Promise.all([eth.start(), poly.start(), sol.start(), stellarW.start()]);

  const tick = async () => {
    try {
      const [ethEvs, polyEvs, solEvs] = await Promise.all([
        eth.pollOnce(),
        poly.pollOnce(),
        sol.pollOnce(),
      ]);
      const all = [...ethEvs, ...polyEvs, ...solEvs];
      for (const ev of all) {
        await minter.enqueue(ev, ev.stellarDest);
      }
      await stellarW.pollOnce();
      const res = await minter.processPending();
      if (res.minted > 0 || res.failed > 0) {
        logger.info(res, "mint cycle complete");
      }
    } catch (err) {
      logger.error({ err }, "tick failed");
    }
  };

  await tick();
  setInterval(tick, config.POLL_INTERVAL_MS);
}

main().catch((err) => {
  logger.fatal({ err }, "fatal");
  process.exit(1);
});
