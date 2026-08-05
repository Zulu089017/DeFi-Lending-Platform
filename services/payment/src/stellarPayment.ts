import {
  Horizon,
  Keypair,
  TransactionBuilder,
  Operation,
  Asset,
  Memo,
} from "@stellar/stellar-sdk";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";

export interface SendPaymentParams {
  fromSecret: string;
  toAddress: string;
  asset: { code: string; issuer?: string };
  amount: string;
  memo?: string;
}

export interface PathPaymentParams {
  fromSecret: string;
  toAddress: string;
  sendAsset: { code: string; issuer?: string };
  sendAmount: string;
  destAsset: { code: string; issuer?: string };
  destMin: string;
  memo?: string;
}

export interface PaymentResult {
  hash: string;
  source: string;
  destination: string;
  asset: string;
  amount: string;
  fee: string;
  ledger: number | null;
  createdAt: string;
}

export interface FeeEstimate {
  fee: string;
  operations: number;
}

export class StellarPaymentService {
  private server: Horizon.Server;

  constructor() {
    this.server = new Horizon.Server(config.STELLAR_RPC);
  }

  async sendPayment(params: SendPaymentParams): Promise<PaymentResult> {
    const kp = Keypair.fromSecret(params.fromSecret);
    const source = await this.server.loadAccount(kp.publicKey());

    const asset = params.asset.issuer
      ? new Asset(params.asset.code, params.asset.issuer)
      : Asset.native();

    const tx = new TransactionBuilder(source, {
      fee: await this.estimateFee(1),
      networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
    }).addOperation(
      Operation.payment({
        destination: params.toAddress,
        asset,
        amount: params.amount,
      }),
    );

    if (params.memo) {
      tx.addMemo(Memo.text(params.memo));
    }

    const built = tx.setTimeout(60).build();
    built.sign(kp);
    const result = await this.server.submitTransaction(built);

    logger.info(
      { hash: result.hash, dest: params.toAddress, amount: params.amount },
      "payment sent",
    );

    return {
      hash: result.hash,
      source: kp.publicKey(),
      destination: params.toAddress,
      asset: params.asset.code,
      amount: params.amount,
      fee: "100000",
      ledger: result.ledger ?? null,
      createdAt: new Date().toISOString(),
    };
  }

  async pathPaymentStrictSend(params: PathPaymentParams): Promise<PaymentResult> {
    const kp = Keypair.fromSecret(params.fromSecret);
    const source = await this.server.loadAccount(kp.publicKey());

    const sendAsset = params.sendAsset.issuer
      ? new Asset(params.sendAsset.code, params.sendAsset.issuer)
      : Asset.native();

    const destAsset = params.destAsset.issuer
      ? new Asset(params.destAsset.code, params.destAsset.issuer)
      : Asset.native();

    const built = new TransactionBuilder(source, {
      fee: await this.estimateFee(1),
      networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.pathPaymentStrictSend({
          destination: params.toAddress,
          sendAsset,
          sendAmount: params.sendAmount,
          destAsset,
          destMin: params.destMin,
        }),
      )
      .setTimeout(60)
      .build();

    built.sign(kp);
    const result = await this.server.submitTransaction(built);

    logger.info(
      { hash: result.hash, dest: params.toAddress },
      "path payment sent",
    );

    return {
      hash: result.hash,
      source: kp.publicKey(),
      destination: params.toAddress,
      asset: `${params.sendAsset.code}→${params.destAsset.code}`,
      amount: params.sendAmount,
      fee: "100000",
      ledger: result.ledger ?? null,
      createdAt: new Date().toISOString(),
    };
  }

  async estimateFee(operations: number): Promise<string> {
    try {
      const base = await this.server.fetchBaseFee();
      return (Number(base) * (operations + 1)).toString();
    } catch {
      return (100_000 * operations).toString();
    }
  }

  async getFeeStats(): Promise<FeeEstimate> {
    const fee = await this.estimateFee(1);
    return { fee, operations: 1 };
  }

  async getTransaction(hash: string) {
    try {
      const tx = await this.server.transactions().transaction(hash).call();
      return {
        hash: tx.hash,
        successful: tx.successful,
        ledger: tx.ledger ?? null,
        createdAt: tx.created_at,
        fee: (tx as any).fee_charged?.toString() ?? "unknown",
        operations: tx.operation_count
          ? [`${tx.operation_count} operations`]
          : [],
      };
    } catch {
      return null;
    }
  }

  async getAccount(publicKey: string) {
    try {
      const acc = await this.server.loadAccount(publicKey);
      const balances = acc.balances.map((b: any) => ({
        asset: b.asset_type === "native" ? "XLM" : b.asset_code,
        balance: b.balance,
        issuer: b.asset_issuer ?? undefined,
      }));

      return {
        id: acc.id,
        sequence: acc.sequence,
        balances,
        subentryCount: acc.subentry_count,
      };
    } catch {
      return null;
    }
  }
}

export const stellarPayment = new StellarPaymentService();
