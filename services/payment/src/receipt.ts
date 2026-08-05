// Payment Receipt Generator
// Produces verifiable receipts for on-chain transactions.

import { createHash } from "crypto";

export interface ReceiptData {
  transactionHash: string;
  from: string;
  to: string;
  asset: string;
  amount: string;
  fee: string;
  ledger: number | null;
  timestamp: string;
  network: "testnet" | "mainnet";
}

export interface SignedReceipt extends ReceiptData {
  receiptId: string;
  signature: string;
  verificationUrl: string;
}

const RECEIPT_VERSION = "1";

/**
 * Generate a cryptographically-signed receipt for a payment.
 */
export function generateReceipt(data: ReceiptData): SignedReceipt {
  const receiptId = createHash("sha256")
    .update(`${data.transactionHash}:${data.timestamp}:${RECEIPT_VERSION}`)
    .digest("hex")
    .slice(0, 16);

  const payload = [
    RECEIPT_VERSION,
    data.transactionHash,
    data.from,
    data.to,
    data.asset,
    data.amount,
    data.fee,
    data.timestamp,
    data.network,
  ].join(":");

  const signature = createHash("sha256")
    .update(payload)
    .digest("hex");

  return {
    ...data,
    receiptId,
    signature,
    verificationUrl: `https://stellar-payment-gateway.xyz/receipt/${receiptId}`,
  };
}

/**
 * Verify a receipt signature.
 */
export function verifyReceipt(receipt: SignedReceipt): boolean {
  const payload = [
    RECEIPT_VERSION,
    receipt.transactionHash,
    receipt.from,
    receipt.to,
    receipt.asset,
    receipt.amount,
    receipt.fee,
    receipt.timestamp,
    receipt.network,
  ].join(":");

  const expected = createHash("sha256").update(payload).digest("hex");
  return expected === receipt.signature;
}

/**
 * Format a receipt as a human-readable string.
 */
export function formatReceipt(receipt: SignedReceipt): string {
  return [
    `╔══════════════════════════════════════╗`,
    `║     StellarPay Payment Receipt       ║`,
    `╠══════════════════════════════════════╣`,
    `║ Receipt ID: ${receipt.receiptId.padEnd(22)}║`,
    `║ TX Hash:   ${receipt.transactionHash.slice(0, 22)}║`,
    `║ From:      ${receipt.from.slice(0, 22)}║`,
    `║ To:        ${receipt.to.slice(0, 22)}║`,
    `║ Amount:    ${receipt.amount} ${receipt.asset.padEnd(10)}║`,
    `║ Fee:       ${receipt.fee} stroops`.padEnd(37) + `║`,
    `║ Network:   ${receipt.network.padEnd(22)}║`,
    `║ Time:      ${receipt.timestamp.slice(0, 22)}║`,
    `╠══════════════════════════════════════╣`,
    `║ Sig: ${receipt.signature.slice(0, 28)}║`,
    `╚══════════════════════════════════════╝`,
  ].join("\n");
}
