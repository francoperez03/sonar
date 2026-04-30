// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

interface IFleetRegistry {
    function deprecate(address[] calldata wallets) external;
}

/// @notice Emits a single WalletsDeprecated event from the deployed FleetRegistry to satisfy CHAIN-02.
contract EmitProbe is Script {
    function run() external {
        string memory json = vm.readFile("../deployments/base-sepolia.json");
        address registry = vm.parseJsonAddress(json, ".FleetRegistry.address");
        uint256 pk = vm.envUint("DEPLOYER_PRIVKEY");

        address[] memory ws = new address[](2);
        ws[0] = address(0xdEaD);
        ws[1] = address(0xBeEf);

        vm.startBroadcast(pk);
        IFleetRegistry(registry).deprecate(ws);
        vm.stopBroadcast();
        console2.log("EmitProbe deprecated 2 wallets via FleetRegistry at:", registry);
    }
}
