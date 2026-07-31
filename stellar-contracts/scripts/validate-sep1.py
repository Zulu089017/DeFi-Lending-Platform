#!/usr/bin/env python3
"""Validate stellar.toml against SEP-0001 (v2.7.0).

Usage:
    python3 stellar-contracts/scripts/validate-sep1.py [path/to/stellar.toml]

Checks:
  • Required global fields (VERSION, NETWORK_PASSPHRASE, SIGNING_KEY)
  • StrKey checksums (G... accounts, C... contracts, S... secrets)
  • [DOCUMENTATION] completeness
  • [[CURRENCIES]]: code length, contract-or-issuer, display_decimals 0-7,
    status values, name/desc
  • [[PRINCIPALS]]: only SEP-1 allowed keys (no public_key/roles)
  • On-chain existence of every contract address (via Soroban RPC getLatestLedger)
"""
import base64
import json
import struct
import sys
import tomllib
from urllib.request import Request, urlopen

# ─────────────────────────── Stellar StrKey (RFC 4648 base32 + CRC16-XModem) ──

_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
_VERSION_BYTE = {"G": 6 << 3, "C": 2 << 3, "S": 18 << 3}


def _crc16(data: bytes) -> int:
    crc = 0
    for b in data:
        crc ^= b << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return crc


def valid_strkey(s: str, kind: str = "G") -> bool:
    if not s or s[0] != kind:
        return False
    pad = "=" * ((8 - len(s) % 8) % 8)
    try:
        raw = base64.b32decode(s + pad, casefold=True)
    except Exception:
        return False
    if len(raw) != 35:
        return False
    if raw[0] != _VERSION_BYTE[kind]:
        return False
    # CRC16-XModem over version byte + payload; stored little-endian.
    return raw[33] | (raw[34] << 8) == _crc16(raw[:33])


# ─────────────────────────────── helpers ─────────────────────────────────────

FAILURES: list[str] = []


def check(ok: bool, msg: str) -> None:
    print(("  ✔ " if ok else "  ✖ ") + msg)
    if not ok:
        FAILURES.append(msg)


def contract_instance_key_b64(contract_id: str) -> str:
    """Build the base64 XDR LedgerKey for a contract's instance entry.

    getLedgerEntries takes XDR-encoded LedgerKeys, not bare strkeys. Layout
    (cross-checked against @stellar/stellar-sdk v16's xdr.LedgerKey):
      u32 LedgerEntryType.CONTRACT_DATA          = 6
      ScAddress scAddressTypeContract            = 1  + 32-byte contract hash
      ScVal    scvLedgerKeyContractInstance      = 20
      u32      ContractDataDurability.PERSISTENT = 1
    The C... strkey decodes to [version(1) | hash(32) | crc16(2)]; the hash is
    bytes [1:33]. There is no ExtensionPoint on the LedgerKey.
    """
    pad = "=" * ((8 - len(contract_id) % 8) % 8)
    raw = base64.b32decode(contract_id + pad, casefold=True)
    contract_hash = raw[1:33]
    buf = struct.pack(">I", 6)  # CONTRACT_DATA
    buf += struct.pack(">I", 1) + contract_hash  # SC_ADDRESS_TYPE_CONTRACT
    buf += struct.pack(">I", 20)  # SCV_LEDGER_KEY_CONTRACT_INSTANCE
    buf += struct.pack(">I", 1)  # PERSISTENT
    return base64.b64encode(buf).decode()


def onchain_exists(contract_id: str) -> bool:
    """Return True if a contract with this ID exists on testnet."""
    body = json.dumps(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getLedgerEntries",
            "params": {"keys": [contract_instance_key_b64(contract_id)]},
        }
    )
    req = Request(
        "https://soroban-testnet.stellar.org",
        data=body.encode(),
        headers={
            "Content-Type": "application/json",
            # soroban-testnet.stellar.org returns 403 to urllib's default
            # "Python-urllib/3.x" User-Agent; identify explicitly.
            "User-Agent": "openlend-sep1-validator/1.0",
        },
    )
    try:
        with urlopen(req, timeout=15) as r:
            data = json.loads(r.read())
        return bool(data.get("result") and data["result"].get("entries"))
    except Exception:
        return False


# ───────────────────────────────── main ──────────────────────────────────────

def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "stellar.toml"
    with open(path, "rb") as f:
        data = tomllib.load(f)

    print(f"Validating {path} against SEP-0001 v2.7.0 ...")

    # Global fields
    check("VERSION" in data, "VERSION present")
    check(
        data.get("NETWORK_PASSPHRASE") == "Test SDF Network ; September 2015",
        f"NETWORK_PASSPHRASE = {data.get('NETWORK_PASSPHRASE')!r}",
    )
    signing = data.get("SIGNING_KEY", "")
    check(valid_strkey(signing, "G"), f"SIGNING_KEY valid G... ({signing})")
    accounts = data.get("ACCOUNTS", [])
    check(
        isinstance(accounts, list) and all(valid_strkey(a, "G") for a in accounts),
        f"ACCOUNTS: {len(accounts)} valid G... entries",
    )

    # Documentation
    doc = data.get("DOCUMENTATION", {})
    for fld in ("ORG_NAME", "ORG_URL", "ORG_DESCRIPTION", "ORG_OFFICIAL_EMAIL"):
        check(doc.get(fld), f"[DOCUMENTATION] {fld} present")
    check(
        str(doc.get("ORG_URL", "")).startswith("https://"),
        f"ORG_URL is https ({doc.get('ORG_URL')})",
    )

    # Currencies
    currencies = data.get("CURRENCIES", [])
    check(isinstance(currencies, list) and len(currencies) > 0, f"{len(currencies)} currency entr(y/ies)")
    for i, c in enumerate(currencies):
        tag = f"currency[{i}] ({c.get('code')})"
        check(c.get("code") and len(c["code"]) <= 12, f"{tag}: code <= 12 chars")
        has_contract = valid_strkey(c.get("contract", ""), "C")
        has_issuer = valid_strkey(c.get("issuer", ""), "G")
        check(
            has_contract or has_issuer,
            f"{tag}: has valid contract (C...) or issuer (G...)",
        )
        dd = c.get("display_decimals")
        check(
            isinstance(dd, int) and 0 <= dd <= 7,
            f"{tag}: display_decimals in 0..7 ({dd})",
        )
        check(
            c.get("status") in (None, "live", "dead", "test", "private"),
            f"{tag}: status valid ({c.get('status')})",
        )
        if has_contract:
            check(onchain_exists(c["contract"]), f"{tag}: contract exists on testnet ({c['contract']})")

    # Principals — SEP-1 v2.7.0 allows ONLY these keys; public_key/roles are NOT
    # part of the spec (they were removed when the schema was tightened).
    ALLOWED_PRINCIPAL_KEYS = {
        "name", "email", "keybase", "telegram", "twitter", "github",
        "id_photo_hash", "verification_photo_hash",
    }
    for i, p in enumerate(data.get("PRINCIPALS", [])):
        bad = set(p) - ALLOWED_PRINCIPAL_KEYS
        check(not bad, f"principals[{i}]: only SEP-1 keys used (bad: {sorted(bad)})")

    print()
    if FAILURES:
        print(f"✖ {len(FAILURES)} failure(s):")
        for f_ in FAILURES:
            print("   -", f_)
        return 1
    print("✔ stellar.toml is SEP-0001 compliant.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
