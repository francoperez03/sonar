// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FleetRegistry
/// @notice Minimal on-chain deprecation registry. Anyone can call deprecate;
///         testnet demo scope only — production-grade access control deferred (D-01).
contract FleetRegistry {
    event WalletsDeprecated(address[] wallets, uint256 timestamp);

    function deprecate(address[] calldata wallets) external {
        emit WalletsDeprecated(wallets, block.timestamp);
    }
}
