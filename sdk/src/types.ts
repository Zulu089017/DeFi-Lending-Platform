export type ChainId = "ethereum" | "polygon" | "solana";

export interface Manifest {
  network: string;
  stellar: {
    rpc: string;
    networkPassphrase: string;
    contracts: {
      wrapped_asset: string;
      oracle: string;
      collateral_vault: string;
      lending_pool: string;
      liquidation: string;
      lending_controller: string;
    };
  };
  evm: Record<string, { bridge: string }>;
  api: string;
}

export interface OpenLendConfig {
  stellar: {
    rpc: string;
    networkPassphrase: string;
    controllerContract: string;
    secretKey: string;
  };
  evm: Record<string, { rpc: string; bridgeAddress: string }>;
  api: string;
}

export interface WrapRequest {
  sourceChain: ChainId;
  token: string;
  amount: string;
  stellarDest: string;
  slippageBps?: number;
}

export interface WrapResult {
  sourceTx: string;
  stellarTx: Promise<string>;
  salt: string;
}

export interface UnwrapRequest {
  amount: string;
  sourceChain: ChainId;
  sourceAddr: string;
}

export interface Market {
  asset: string;
  totalSupply: string;
  totalBorrow: string;
  utilization: number;
  supplyApy: number;
  borrowApy: number;
}

export interface Position {
  user: string;
  collateral: Record<string, string>;
  debt: Record<string, string>;
}

export type StreamEvent =
  | { type: "wrap"; data: any }
  | { type: "unwrap"; data: any }
  | { type: "lending"; data: any }
  | { type: "bridge"; data: any };
