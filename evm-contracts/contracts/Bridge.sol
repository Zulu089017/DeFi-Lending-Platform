// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
// OZ 5.x removed `ReentrancyGuardUpgradeable` and replaced it with a
// `ReentrancyGuard` that uses ERC-7201 namespaced storage
// (`@custom:stateless`, storage slot derived from
// `keccak256("openzeppelin.storage.ReentrancyGuard") - 1`). This is
// safe to inherit from an upgradeable contract because the state lives
// outside the linear storage layout, so adding it to the inheritance
// chain does NOT shift the slots used by other upgradeable parents
// (Ownable, Pausable, EIP712). Source:
// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.x/contracts/utils/ReentrancyGuard.sol
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";

// OpenZeppelin ECDSA replaces the custom `ECDSA_recover`. The library
// provides built-in malleability protection (`s` value bound to the lower
// half-order of secp256k1) and clear revert reasons.
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// TODO(audit): OZ's `ReentrancyGuard` is marked
// "Deprecated. This storage-based reentrancy guard will be removed and
// replaced by the {ReentrancyGuardTransient} variant in v6.0." (see
// node_modules/@openzeppelin/contracts/utils/ReentrancyGuard.sol).
// Once the target chains support EIP-1153 transient storage and we
// upgrade to OZ v6, switch to `ReentrancyGuardTransient` to remove
// the SSTORE/SLOAD cost on every guarded call.

/// @title OpenLend EVM Bridge
/// @notice Locks (or burns) canonical ERC-20 tokens on the source chain and emits
///         events that the off-chain OpenLend bridge middleware watches to
///         mint wrapped tokens on Stellar.
/// @custom:oz-upgrades Not yet deployed. On a first deployment this layout is
///        final; for any pre-existing proxy deployment, upgrading to this
///        version requires an ERC-7201 storage-layout audit (EIP712Upgradeable
///        was newly added in this version) plus a re-init of EIP-712
///        name/version. The reentrancy guard (`ReentrancyGuard`, see below)
///        uses ERC-7201 namespaced storage (slot 0x9b779b...) per the
///        OpenZeppelin stateless pattern, so it does NOT shift linear
///        storage and does not need to be re-initialised on upgrade.
contract Bridge is
    Initializable,
    EIP712Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // ────────────────────────────── EIP-712 ───────────────────────────────
    // EIP-712 domain separator fields. Initialized in `initialize` via
    // `__EIP712_init(name, version)`; the domain separator is recomputed
    // lazily on each use (and re-cached) so it tracks `block.chainid`
    // across hardforks. The type hash for the `Release` struct is the
    // canonical EIP-712 type string — MUST match the off-chain signer
    // (bridge/src/attest/signer.ts → `signEvmRelease`) byte-for-byte,
    // including parameter order and Solidity canonical type names
    // (`uint256` not `uint`, `bytes32` not `bytes`, no `address[]`).
    bytes32 private constant RELEASE_TYPEHASH =
        keccak256("Release(address token,address recipient,uint256 amount,bytes32 stellarTxHash,uint256 nonce)");

    // ────────────────────────────── Custom errors ─────────────────────────
    // Custom errors save gas vs `require(str, ...)` and are easier to assert
    // on off-chain (the error selector is a 4-byte hash of the name + args).
    // Auditors prefer them because they appear in the ABI as named types.
    error Bridge__AlreadyInitialized();
    error Bridge__TokenDisabled(address token);
    error Bridge__AmountOutOfRange(uint256 amount, uint256 min, uint256 max);
    error Bridge__SaltReused(bytes32 salt);
    error Bridge__InvalidDest();
    error Bridge__InvalidRecipient();
    error Bridge__BadThreshold(uint256 threshold, uint256 length);
    error Bridge__ZeroAttester();
    error Bridge__BadSigLength(uint256 length);
    error Bridge__NotAttester(address signer);
    error Bridge__DuplicateSignature(address signer);
    error Bridge__InsufficientSignatures(uint256 got, uint256 need);
    error Bridge__BurnFailed();

    // ────────────────────────────── Structs ──────────────────────────────

    struct AttesterSet {
        address[] attesters;
        uint256 threshold; // 2-of-3, 3-of-5, etc.
    }

    struct TokenConfig {
        bool enabled;
        uint256 minAmount;
        uint256 maxAmount;
    }

    // ────────────────────────────── Storage ──────────────────────────────

    /// @dev Maps Stellar destination pubkey hash to nonces
    mapping(bytes32 => bool) public usedNonces;

    /// @dev Per-token configuration
    mapping(address => TokenConfig) public tokenConfigs;

    /// @dev Attester set
    AttesterSet public attesters;

    /// @dev Mapping to quickly check attester membership
    mapping(address => bool) public isAttester;

    /// @dev Number of locks per (user, token) — could be used for rate limiting
    mapping(address => mapping(address => uint256)) public userLockCount;

    // ────────────────────────────── Events ───────────────────────────────

    event Locked(
        address indexed sender,
        address indexed token,
        uint256 amount,
        bytes32 indexed stellarDest,
        bytes32 salt,
        uint256 nonce
    );

    event Burned(
        address indexed sender,
        address indexed token,
        uint256 amount,
        bytes32 indexed stellarDest,
        bytes32 salt,
        uint256 nonce
    );

    event Released(
        address indexed recipient,
        address indexed token,
        uint256 amount,
        bytes32 indexed stellarTxHash,
        uint256 nonce
    );

    event AttesterSetUpdated(address[] attesters, uint256 threshold);
    event TokenConfigUpdated(address indexed token, bool enabled, uint256 minAmount, uint256 maxAmount);

    // ────────────────────────────── Init ─────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address[] calldata _attesters,
        uint256 _threshold
    ) external initializer {
        __EIP712_init("OpenLend Bridge", "1");
        __Ownable_init(msg.sender);
        __Pausable_init();
        // OZ 5.x `ReentrancyGuard` is `@custom:stateless` and uses ERC-7201
        // namespaced storage; it has no `__ReentrancyGuard_init()` because
        // its `constructor()` writes the `NOT_ENTERED` sentinel to the
        // namespaced slot directly. The first proxy call sees 0 (no
        // entry), which the guard's `== ENTERED (2)` check treats as
        // "not entered" — see OZ v5.x ReentrancyGuard.sol.
        _setAttesters(_attesters, _threshold);
    }

    // ────────────────────────────── User flows ───────────────────────────

    /// @notice Lock canonical tokens; emits a `Locked` event for the bridge middleware.
    /// @param token         The canonical ERC-20 token address
    /// @param amount        The amount of tokens to lock
    /// @param stellarDest   The Stellar destination account (32-byte ed25519 pubkey hash)
    /// @param salt          A unique 32-byte salt to prevent replay
    /// @return nonce        The replay-protection nonce
    function lock(
        address token,
        uint256 amount,
        bytes32 stellarDest,
        bytes32 salt
    ) external whenNotPaused nonReentrant returns (uint256 nonce) {
        // Checks
        TokenConfig memory cfg = tokenConfigs[token];
        if (!cfg.enabled) revert Bridge__TokenDisabled(token);
        if (amount < cfg.minAmount || amount > cfg.maxAmount) {
            revert Bridge__AmountOutOfRange(amount, cfg.minAmount, cfg.maxAmount);
        }
        if (usedNonces[salt]) revert Bridge__SaltReused(salt);
        if (stellarDest == bytes32(0)) revert Bridge__InvalidDest();

        // Interactions (effects happen after the transfer succeeds so a
        // failed safeTransferFrom does not consume the salt).
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Effects
        usedNonces[salt] = true;
        userLockCount[msg.sender][token] += 1;
        nonce = uint256(keccak256(abi.encodePacked(msg.sender, token, amount, salt, block.chainid)));

        emit Locked(msg.sender, token, amount, stellarDest, salt, nonce);
    }

    /// @notice Burn canonical (ownable) tokens; emits a `Burned` event.
    ///         Used when the source chain token is the canonical token (e.g. WETH).
    function burn(
        address token,
        uint256 amount,
        bytes32 stellarDest,
        bytes32 salt
    ) external whenNotPaused nonReentrant returns (uint256 nonce) {
        TokenConfig memory cfg = tokenConfigs[token];
        if (!cfg.enabled) revert Bridge__TokenDisabled(token);
        if (amount < cfg.minAmount || amount > cfg.maxAmount) {
            revert Bridge__AmountOutOfRange(amount, cfg.minAmount, cfg.maxAmount);
        }
        if (usedNonces[salt]) revert Bridge__SaltReused(salt);
        if (stellarDest == bytes32(0)) revert Bridge__InvalidDest();

        usedNonces[salt] = true;
        nonce = uint256(keccak256(abi.encodePacked(msg.sender, token, amount, salt, block.chainid)));

        // For burnable tokens, the user must have approved the bridge and the
        // token must implement burn. For ERC-20-only, use `lock` instead.
        (bool ok, bytes memory ret) = token.call(
            abi.encodeWithSignature("burnFrom(address,uint256)", msg.sender, amount)
        );
        if (!(ok && (ret.length == 0 || abi.decode(ret, (bool))))) revert Bridge__BurnFailed();

        emit Burned(msg.sender, token, amount, stellarDest, salt, nonce);
    }

    /// @notice Release locked tokens to `recipient` on the source chain, after the
    ///         off-chain bridge has verified a `Unwrap` event on Stellar.
    /// @dev    Only callable when attesters have signed the EIP-712 typed
    ///         digest. The domain (`OpenLend Bridge` / `1`) is initialised
    ///         in `initialize`; the `Release` type hash is pinned in
    ///         `RELEASE_TYPEHASH`. Closes invariant B-7. Off-chain
    ///         counterpart: `bridge/src/attest/signer.ts` → `signEvmRelease`.
    function release(
        address token,
        address recipient,
        uint256 amount,
        bytes32 stellarTxHash,
        uint256 nonce,
        bytes[] calldata signatures
    ) external whenNotPaused nonReentrant {
        if (recipient == address(0)) revert Bridge__InvalidRecipient();
        // `abi.encode` (not `abi.encodePacked`) so each field is padded to
        // 32 bytes — the canonical EIP-712 struct hash layout.
        bytes32 structHash = keccak256(
            abi.encode(
                RELEASE_TYPEHASH,
                token,
                recipient,
                amount,
                stellarTxHash,
                nonce
            )
        );
        _verifySignatures(_hashTypedDataV4(structHash), signatures);
        IERC20(token).safeTransfer(recipient, amount);
        emit Released(recipient, token, amount, stellarTxHash, nonce);
    }

    // ────────────────────────────── Admin ────────────────────────────────

    function setTokenConfig(
        address token,
        bool enabled,
        uint256 minAmount,
        uint256 maxAmount
    ) external onlyOwner {
        tokenConfigs[token] = TokenConfig(enabled, minAmount, maxAmount);
        emit TokenConfigUpdated(token, enabled, minAmount, maxAmount);
    }

    function setAttesters(
        address[] calldata _attesters,
        uint256 _threshold
    ) external onlyOwner {
        // Require strict < to prevent full-quorum (1-of-1, 2-of-2) where any
        // single key compromise is fatal.
        if (_threshold >= _attesters.length) revert Bridge__BadThreshold(_threshold, _attesters.length);
        _setAttesters(_attesters, _threshold);
    }

    function setPaused(bool _paused) external onlyOwner {
        if (_paused) _pause();
        else _unpause();
    }

    function withdrawStuck(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    // ────────────────────────────── Internal ────────────────────────────

    function _setAttesters(address[] calldata _attesters, uint256 _threshold) internal {
        if (_threshold == 0 || _threshold > _attesters.length) {
            revert Bridge__BadThreshold(_threshold, _attesters.length);
        }

        // Clear old attester flags
        address[] memory old = attesters.attesters;
        for (uint256 i = 0; i < old.length; i++) {
            isAttester[old[i]] = false;
        }

        // Set new attester flags
        for (uint256 i = 0; i < _attesters.length; i++) {
            if (_attesters[i] == address(0)) revert Bridge__ZeroAttester();
            isAttester[_attesters[i]] = true;
        }

        attesters = AttesterSet(_attesters, _threshold);
        emit AttesterSetUpdated(_attesters, _threshold);
    }

    function _verifySignatures(bytes32 digest, bytes[] calldata signatures) internal view {
        // Recover each signature via OpenZeppelin's ECDSA (membership + dup
        // checks). We do NOT require ascending order — multisig wallets are
        // not ordered.
        uint256 validCount = 0;
        for (uint256 i = 0; i < signatures.length; i++) {
            if (signatures[i].length != 65) revert Bridge__BadSigLength(signatures[i].length);
            address signer = ECDSA.recover(digest, signatures[i]);
            if (!isAttester[signer]) revert Bridge__NotAttester(signer);
            // Reset and re-check uniqueness by walking the signatures.
            for (uint256 j = 0; j < i; j++) {
                address prev = ECDSA.recover(digest, signatures[j]);
                if (prev == signer) revert Bridge__DuplicateSignature(signer);
            }
            // TODO(audit): O(n²) duplicate check is fine for quorum ≤ 5; if
            // the attester set grows, switch to sort + linear scan (O(n log n))
            // or a `mapping(address => bool) seen` (O(n) gas, O(n) storage).
            validCount++;
        }
        if (validCount < attesters.threshold) {
            revert Bridge__InsufficientSignatures(validCount, attesters.threshold);
        }
    }

    // The custom `ECDSA_recover` and `AttisterSetWrapped` helpers were
    // removed in favour of OpenZeppelin's `ECDSA.recover` and direct struct
    // construction. This eliminates ~60 lines of hand-rolled crypto code
    // and inherits the OpenZeppelin library's malleability protection
    // and revert reasons. See `docs/invariants.md` § 7 (B-7) for the
    // remaining EIP-712 work tracked in the security model.
}
