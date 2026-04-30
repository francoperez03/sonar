// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FleetRegistry} from "../src/FleetRegistry.sol";

contract FleetRegistryTest is Test {
    FleetRegistry reg;

    event WalletsDeprecated(address[] wallets, uint256 timestamp);

    function setUp() public {
        reg = new FleetRegistry();
    }

    function test_Deprecate_EmitsEvent() public {
        address[] memory ws = new address[](2);
        ws[0] = address(0x1111);
        ws[1] = address(0x2222);

        vm.expectEmit(true, true, true, true, address(reg));
        emit WalletsDeprecated(ws, block.timestamp);

        reg.deprecate(ws);
    }

    function test_Deprecate_EmptyArray_StillEmits() public {
        address[] memory ws = new address[](0);
        vm.expectEmit(true, true, true, true, address(reg));
        emit WalletsDeprecated(ws, block.timestamp);
        reg.deprecate(ws);
    }
}
