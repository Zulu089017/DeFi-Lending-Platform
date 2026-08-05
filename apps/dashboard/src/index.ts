// Portfolio Overview Dashboard
// Displays user positions, TVL, health factor, and lending activity.

export interface PortfolioPosition {
  asset: string;
  supplied: string;
  suppliedUsd: number;
  borrowed: string;
  borrowedUsd: number;
  collateral: string;
  collateralUsd: number;
  apy: number;
}

export interface PortfolioSummary {
  totalSuppliedUsd: number;
  totalBorrowedUsd: number;
  totalCollateralUsd: number;
  netWorthUsd: number;
  healthFactor: number;
  availableToBorrowUsd: number;
}

export function computePortfolioSummary(positions: PortfolioPosition[]): PortfolioSummary {
  const totalSuppliedUsd = positions.reduce((s, p) => s + p.suppliedUsd, 0);
  const totalBorrowedUsd = positions.reduce((s, p) => s + p.borrowedUsd, 0);
  const totalCollateralUsd = positions.reduce((s, p) => s + p.collateralUsd, 0);

  const netWorthUsd = totalSuppliedUsd + totalCollateralUsd - totalBorrowedUsd;
  const healthFactor = totalBorrowedUsd > 0
    ? totalCollateralUsd / totalBorrowedUsd
    : Number.POSITIVE_INFINITY;

  const availableToBorrowUsd = totalCollateralUsd * 0.75 - totalBorrowedUsd; // 75% LTV

  return {
    totalSuppliedUsd,
    totalBorrowedUsd,
    totalCollateralUsd,
    netWorthUsd,
    healthFactor,
    availableToBorrowUsd: Math.max(0, availableToBorrowUsd),
  };
}

export const DEFAULT_POSITIONS: PortfolioPosition[] = [
  {
    asset: "XLM",
    supplied: "50,000",
    suppliedUsd: 5_000,
    borrowed: "0",
    borrowedUsd: 0,
    collateral: "100,000",
    collateralUsd: 10_000,
    apy: 2.8,
  },
  {
    asset: "wETH",
    supplied: "1.5",
    suppliedUsd: 3_750,
    borrowed: "0.3",
    borrowedUsd: 750,
    collateral: "2.0",
    collateralUsd: 5_000,
    apy: 1.2,
  },
  {
    asset: "wUSDC",
    supplied: "10,000",
    suppliedUsd: 10_000,
    borrowed: "2,000",
    borrowedUsd: 2_000,
    collateral: "5,000",
    collateralUsd: 5_000,
    apy: 4.5,
  },
];
