// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {FleetRegistry} from "../src/FleetRegistry.sol";

/// @notice Deploy FleetRegistry to whatever chain --rpc-url points at.
/// @dev    Reads DEPLOYER_PRIVKEY from env (loaded via contracts/.env in Plan 02 invocation).
///         Plan 02 wraps this with `pnpm deploy:contracts` and a post-script that writes
///         deployments/base-sepolia.json. This script alone does NOT touch the deployments file
///         (separation of concerns — Solidity here, JSON write in TS post-step).
contract Deploy is Script {
    function run() external returns (FleetRegistry reg) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVKEY");
        vm.startBroadcast(pk);
        reg = new FleetRegistry();
        vm.stopBroadcast();
        console2.log("FleetRegistry deployed at:", address(reg));
    }
}
