/** Thin client-side wrapper around @stellar/stellar-sdk for our protocol. */
"use client";
import { Horizon, Networks } from "@stellar/stellar-sdk";

const RPC = process.env.NEXT_PUBLIC_STELLAR_RPC ?? "https://horizon-testnet.stellar.org";
const PASSPHRASE = process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ?? Networks.TESTNET;
export const CONTROLLER = process.env.NEXT_PUBLIC_STELLAR_CONTROLLER ?? "";

export const server = typeof window === "undefined" ? null : new Horizon.Server(RPC);
export const horizonUrl = RPC;
export const networkPassphrase = PASSPHRASE;
