// Canonical type definitions shared across StellarPay packages.

/** Supported blockchain networks */
export type ChainId = "ethereum" | "polygon" | "solana" | "stellar";

/** Stellar network mode */
export type StellarNetwork = "testnet" | "mainnet" | "futurenet";

/** Asset identifier (symbol or contract address) */
export type AssetSymbol = string;

/** A market configuration for the lending pool */
export interface MarketConfig {
  asset: AssetSymbol;
  ltvBps: number; // max loan-to-value in basis points
  liquidationThresholdBps: number;
  baseRateBps: number;
  slope1Bps: number;
  slope2Bps: number;
  kinkBps: number;
  reserveFactorBps: number;
}

/** User position snapshot */
export interface Position {
  user: string;
  collateral: Record<AssetSymbol, string>;
  debt: Record<AssetSymbol, string>;
  healthFactor: number;
}

/** Payment receipt (signed by attester) */
export interface PaymentReceipt {
  id: string;
  txHash: string;
  from: string;
  to: string;
  amount: string;
  asset: AssetSymbol;
  chain: ChainId;
  timestamp: number;
  signature: string;
}

/** Bridge event from a source chain */
export interface BridgeEvent {
  type: "locked" | "burned" | "released";
  chain: ChainId;
  txHash: string;
  token: string;
  sender: string;
  recipient: string;
  amount: string;
  blockNumber: number;
  timestamp: number;
}

/** Lending event */
export interface LendingEvent {
  type: "supply" | "withdraw" | "borrow" | "repay" | "liquidate";
  user: string;
  asset: AssetSymbol;
  amount: string;
  txHash: string;
  timestamp: number;
}

/** Governor proposal state */
export type ProposalState =
  | "active"
  | "succeeded"
  | "defeated"
  | "executed"
  | "cancelled";

/** Governance proposal */
export interface Proposal {
  id: number;
  proposer: string;
  title: string;
  description: string;
  state: ProposalState;
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  createdAt: number;
  votingEnds: number;
  executionTime?: number;
}

/** Health factor band */
export type HealthStatus = "safe" | "warning" | "danger";
