// TVL Metrics Service
// Aggregates Total Value Locked across all lending markets and chains.

export interface TvlSnapshot {
  timestamp: string;
  totalTvlUsd: number;
  byChain: Record<string, number>;
  byAsset: Record<string, TvlAsset>;
}

export interface TvlAsset {
  symbol: string;
  tvl: number; // in token units
  tvlUsd: number;
  supplyApy: number;
  borrowApy: number;
  utilization: number; // 0-100%
}

export class TvlMetrics {
  private snapshots: TvlSnapshot[] = [];

  /** Compute current TVL from live data. */
  async computeTvl(): Promise<TvlSnapshot> {
    // In production: query the indexer/oracle for live data.
    // Here we return computed mock data representing the protocol state.
    const snapshot: TvlSnapshot = {
      timestamp: new Date().toISOString(),
      totalTvlUsd: 12_400_000,
      byChain: {
        stellar: 8_200_000,
        ethereum: 2_800_000,
        polygon: 960_000,
        solana: 440_000,
      },
      byAsset: {
        XLM: {
          symbol: "XLM",
          tvl: 50_000_000,
          tvlUsd: 5_000_000,
          supplyApy: 2.8,
          borrowApy: 4.2,
          utilization: 62,
        },
        wETH: {
          symbol: "wETH",
          tvl: 1_200,
          tvlUsd: 3_000_000,
          supplyApy: 1.2,
          borrowApy: 2.5,
          utilization: 45,
        },
        wUSDC: {
          symbol: "wUSDC",
          tvl: 4_400_000,
          tvlUsd: 4_400_000,
          supplyApy: 4.5,
          borrowApy: 6.8,
          utilization: 78,
        },
      },
    };

    this.snapshots.push(snapshot);
    // Keep last 100 snapshots
    if (this.snapshots.length > 100) {
      this.snapshots = this.snapshots.slice(-100);
    }

    return snapshot;
  }

  /** Get the latest TVL snapshot. */
  getLatest(): TvlSnapshot | null {
    return this.snapshots.length > 0
      ? this.snapshots[this.snapshots.length - 1]
      : null;
  }

  /** Get TVL change over a period (in seconds). */
  getChange(periodSeconds: number): { absolute: number; percentage: number } | null {
    if (this.snapshots.length < 2) return null;

    const now = this.snapshots[this.snapshots.length - 1];
    const cutoff = Date.now() - periodSeconds * 1000;

    for (let i = this.snapshots.length - 2; i >= 0; i--) {
      if (new Date(this.snapshots[i].timestamp).getTime() < cutoff) {
        const absolute = now.totalTvlUsd - this.snapshots[i].totalTvlUsd;
        const percentage = this.snapshots[i].totalTvlUsd > 0
          ? (absolute / this.snapshots[i].totalTvlUsd) * 100
          : 0;
        return { absolute, percentage };
      }
    }

    return null;
  }
}

export const tvlMetrics = new TvlMetrics();
