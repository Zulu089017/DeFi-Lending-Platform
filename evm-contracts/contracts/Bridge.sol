// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @title OpenLend EVM Bridge
/// @notice Locks (or burns) canonical ERC-20 tokens on the source chain and emits
///         events that the off-chain OpenLend bridge middleware watches to
///         mint wrapped tokens on Stellar.
contract Bridge is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

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
        __Ownable_init(msg.sender);
        __Pausable_init();
        __ReentrancyGuard_init();
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
        require(cfg.enabled, "Bridge: token disabled");
        require(amount >= cfg.minAmount && amount <= cfg.maxAmount, "Bridge: amount out of range");
        require(!usedNonces[salt], "Bridge: salt reused");
        require(stellarDest != bytes32(0), "Bridge: invalid dest");

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
        require(cfg.enabled, "Bridge: token disabled");
        require(amount >= cfg.minAmount && amount <= cfg.maxAmount, "Bridge: amount out of range");
        require(!usedNonces[salt], "Bridge: salt reused");
        require(stellarDest != bytes32(0), "Bridge: invalid dest");

        usedNonces[salt] = true;
        nonce = uint256(keccak256(abi.encodePacked(msg.sender, token, amount, salt, block.chainid)));

        // For burnable tokens, the user must have approved the bridge and the
        // token must implement burn. For ERC-20-only, use `lock` instead.
        (bool ok, bytes memory ret) = token.call(
            abi.encodeWithSignature("burnFrom(address,uint256)", msg.sender, amount)
        );
        require(ok && (ret.length == 0 || abi.decode(ret, (bool))), "Bridge: burn failed");

        emit Burned(msg.sender, token, amount, stellarDest, salt, nonce);
    }

    /// @notice Release locked tokens to `recipient` on the source chain, after the
    ///         off-chain bridge has verified a `Unwrap` event on Stellar.
    /// @dev    Only callable when attesters have signed the release.
    function release(
        address token,
        address recipient,
        uint256 amount,
        bytes32 stellarTxHash,
        uint256 nonce,
        bytes[] calldata signatures
    ) external whenNotPaused nonReentrant {
        require(recipient != address(0), "Bridge: invalid recipient");
        _verifySignatures(
            keccak256(abi.encodePacked("RELEASE", token, recipient, amount, stellarTxHash, nonce)),
            signatures
        );
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
        require(_threshold < _attesters.length, "Bridge: threshold must be < length");
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
        require(_threshold > 0 && _threshold <= _attesters.length, "Bridge: bad threshold");

        // Clear old attester flags
        address[] memory old = attesters.attesters;
        for (uint256 i = 0; i < old.length; i++) {
            isAttester[old[i]] = false;
        }

        // Set new attester flags
        for (uint256 i = 0; i < _attesters.length; i++) {
            require(_attesters[i] != address(0), "Bridge: zero attester");
            isAttester[_attesters[i]] = true;
        }

        attesters = AttisterSetWrapped(_attesters, _threshold);
        emit AttesterSetUpdated(_attesters, _threshold);
    }

    function _verifySignatures(bytes32 digest, bytes[] calldata signatures) internal view {
        // Track which attesters have already signed to prevent duplicates.
        // We do NOT require ascending order — multisig wallets are not ordered.
        uint256 validCount = 0;
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = ECDSA_recover(digest, signatures[i]);
            require(isAttester[signer], "Bridge: not an attester");
            // Reset and re-check uniqueness by walking the signatures.
            bool duplicate = false;
            for (uint256 j = 0; j < i; j++) {
                address prev = ECDSA_recover(digest, signatures[j]);
                if (prev == signer) {
                    duplicate = true;
                    break;
                }
            }
            require(!duplicate, "Bridge: duplicate signature");
            validCount++;
        }
        require(validCount >= attesters.threshold, "Bridge: insufficient sigs");
    }

    // Production should use @openzeppelin/contracts/utils/cryptography/ECDSA.sol
    // (which adds malleability protection and EIP-712 domain support).
    function ECDSA_recover(bytes32 digest, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "Bridge: bad sig length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        require(v == 27 || v == 28, "Bridge: bad v");
        // Bound `s` to the lower half-order of the secp256k1 curve to
        // prevent signature malleability.
        require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0, "Bridge: bad s");
        return ecrecover(digest, v, r, s);
    }

    // Avoid name-shadowing with the struct; small wrapper for clarity
    function AttisterSetWrapped(
        address[] memory _attesters,
        uint256 _threshold
    ) internal pure returns (AttesterSet memory) {
        return AttesterSet(_attesters, _threshold);
    }
}
