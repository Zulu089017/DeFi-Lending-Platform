import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

/** Compute positions + health factor for a user. The scaffold aggregates
 *  events to derive collateral and debt; production reads directly from
 *  the on-chain lending_pool and collateral_vault. */
export async function positionsRoutes(app: FastifyInstance) {
  app.get<{ Params: { user: string } }>("/v1/positions/:user", async (req) => {
    const user = req.params.user;
    const events = await prisma.lendingEvent.findMany({
      where: { user },
      orderBy: { createdAt: "asc" },
    });

    const supplies: Record<string, bigint> = {};
    const borrows: Record<string, bigint> = {};
    for (const e of events) {
      if (e.type === "supply") supplies[e.asset] = (supplies[e.asset] ?? 0n) + e.amount;
      if (e.type === "borrow") borrows[e.asset] = (borrows[e.asset] ?? 0n) + e.amount;
      if (e.type === "repay") borrows[e.asset] = (borrows[e.asset] ?? 0n) - e.amount;
      if (e.type === "withdraw") supplies[e.asset] = (supplies[e.asset] ?? 0n) - e.amount;
    }

    return {
      user,
      collateral: Object.fromEntries(
        Object.entries(supplies).map(([a, v]) => [a, v.toString()]),
      ),
      debt: Object.fromEntries(
        Object.entries(borrows).map(([a, v]) => [a, v.toString()]),
      ),
    };
  });

  app.get<{ Params: { user: string } }>("/v1/health-factor/:user", async (req) => {
    // Production: collat_value_usd * liq_threshold / debt_value_usd, with
    // values pulled from the oracle. The scaffold computes a synthetic HF
    // from summed event totals and a default 85% liq threshold.
    const events = await prisma.lendingEvent.findMany({
      where: { user: req.params.user },
    });
    let collat = 0n;
    let debt = 0n;
    for (const e of events) {
      if (e.type === "supply") collat += e.amount;
      if (e.type === "borrow") debt += e.amount;
      if (e.type === "repay") debt = debt > e.amount ? debt - e.amount : 0n;
      if (e.type === "withdraw") collat = collat > e.amount ? collat - e.amount : 0n;
    }
    const LIQ_THRESHOLD = 0.85;
    const hf = debt === 0n ? Infinity : (Number(collat) * LIQ_THRESHOLD) / Number(debt);
    return {
      user: req.params.user,
      healthFactor: hf,
      status: hf < 1 ? "liquidatable" : hf < 1.2 ? "warn" : "ok",
    };
  });
}
