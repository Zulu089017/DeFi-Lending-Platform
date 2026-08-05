// Reusable Stellar Transaction Helper
// Extracted from services/payment/stellarPayment.ts for shared use.

import {
  Horizon,
  Keypair,
  TransactionBuilder,
  Operation,
  Asset,
  Memo,
  type Transaction,
} from "@stellar/stellar-sdk";

export interface TxOptions {
  rpcUrl: string;
  networkPassphrase: string;
  fee?: string;
  timeout?: number;
  memo?: string;
}

export interface PaymentOp {
  destination: string;
  asset: { code: string; issuer?: string };
  amount: string;
}

export interface TxResult {
  hash: string;
  source: string;
  ledger: number | null;
  feeCharged: string;
}

/**
 * Build, sign, and submit a Stellar transaction in one call.
 */
export async function buildAndSubmit(
  fromSecret: string,
  operations: Array<"payment" | "pathPayment"> & { op: string; params: Record<string, unknown> },
  options: TxOptions,
): Promise<TxResult> {
  const kp = Keypair.fromSecret(fromSecret);
  const server = new Horizon.Server(options.rpcUrl);
  const source = await server.loadAccount(kp.publicKey());

  const fee = options.fee ?? await estimateFee(server, 1);
  let builder = new TransactionBuilder(source, {
    fee,
    networkPassphrase: options.networkPassphrase,
  });

  for (const op of operations as any[]) {
    builder = builder.addOperation(op);
  }

  if (options.memo) {
    builder = builder.addMemo(Memo.text(options.memo));
  }

  const tx = builder.setTimeout(options.timeout ?? 60).build();
  tx.sign(kp);
  const result = await server.submitTransaction(tx);

  return {
    hash: result.hash,
    source: kp.publicKey(),
    ledger: result.ledger ?? null,
    feeCharged: "100000",
  };
}

/**
 * Build a payment operation.
 */
export function paymentOp(params: PaymentOp) {
  const asset = params.asset.issuer
    ? new Asset(params.asset.code, params.asset.issuer)
    : Asset.native();

  return Operation.payment({
    destination: params.destination,
    asset,
    amount: params.amount,
  });
}

/**
 * Estimate the base fee for a given number of operations.
 */
export async function estimateFee(
  server: Horizon.Server,
  operations: number,
): Promise<string> {
  try {
    const base = await server.fetchBaseFee();
    return (Number(base) * (operations + 1)).toString();
  } catch {
    return (100_000 * operations).toString();
  }
}

/**
 * Validate a Stellar secret key format.
 */
export function isValidStellarSecret(secret: string): boolean {
  return /^S[A-Z2-7]{55}$/.test(secret);
}

/**
 * Validate a Stellar public key format.
 */
export function isValidStellarPublicKey(key: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(key);
}
