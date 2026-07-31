/** Chains whose `Locked`/`Burned` events can mint on Stellar. */
export type SourceChainId = "ethereum" | "polygon" | "solana";

/** Any chain the bridge watches, including Stellar (unwrap events only). */
export type ChainId = SourceChainId | "stellar";

export interface SourceEvent {
  chain: ChainId;
  txHash: string;
  logIndex: number;
  blockNumber: number;
  sender: string;
  token: string;
  amount: bigint;
  stellarDest: string; // ed25519 pubkey
  salt: string; // 32-byte hex
  nonce: bigint;
  raw: unknown;
}

export interface StellarMintRequest {
  chain: SourceChainId;
  sourceTx: string;
  sourceLogIndex: number;
  sourceAddress: string;
  amount: bigint;
  to: string;
  salt: string;
}

export interface UnwrapEvent {
  chain: ChainId;
  txHash: string;
  user: string;
  amount: bigint;
  sourceChain: ChainId;
  sourceAddr: string;
  nonce: string;
}

export interface BridgeStatus {
  service: "bridge";
  uptimeSec: number;
  lastBlockEthereum: number | null;
  lastBlockPolygon: number | null;
  lastSlotSolana: number | null;
  processedEvents: number;
  pendingMints: number;
}
