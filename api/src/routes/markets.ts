import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

/** Compute APY / utilization from raw lending events. Shared between the
 *  /v1/markets (all assets) and /v1/markets/:asset (single asset) handlers. */
async function computeMarkets(asset?: string) {
  const events = await prisma.lendingEvent.groupBy({
    by: ["asset", "type"],
    where: asset ? { asset } : {},
    _sum: { amount: true },
  });

  const v = { supply: 0n, borrow: 0n, repay: 0n };
  for (const e of events) {
    if (e.type === "supply") v.supply += e._sum.amount ?? 0n;
    if (e.type === "borrow") v.borrow += e._sum.amount ?? 0n;
    if (e.type === "repay") v.repay += e._sum.amount ?? 0n;
  }

  const totalSupply = v.supply;
  const totalBorrow = v.borrow - v.repay;
  const utilization = totalSupply === 0n ? 0 : Number((totalBorrow * 10_000n) / totalSupply) / 10_000;
  // Kinked rate: 0% at 0% util, 5% at 80% (kink), 50% at 100%
  const borrowApy = utilization <= 0.8
    ? utilization * 0.0625
    : 0.05 + (utilization - 0.8) * 2.25;
  const supplyApy = borrowApy * utilization * 0.9; // 10% reserve factor

  return {
    totalSupply: totalSupply.toString(),
    totalBorrow: totalBorrow.toString(),
    utilization,
    supplyApy,
    borrowApy,
  };
}

export async function marketsRoutes(app: FastifyInstance) {
  app.get("/v1/markets", async () => {
    const groups = await prisma.lendingEvent.groupBy({
      by: ["asset"],
      _count: { _all: true },
    });
    return Promise.all(
      groups.map(async (g) => ({ asset: g.asset, ...(await computeMarkets(g.asset)) })),
    );
  });

  app.get<{ Params: { asset: string } }>("/v1/markets/:asset", async (req, reply) => {
    const asset = decodeURIComponent(req.params.asset);
    return { asset, ...(await computeMarkets(asset)) };
  });
}
