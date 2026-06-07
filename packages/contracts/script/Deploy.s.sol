// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/PharosPayUSD.sol";
import "../src/PharosPayLedger.sol";

/// @notice Deploys pUSD + PharosPayLedger. Run with:
///   forge script script/Deploy.s.sol --rpc-url <RPC> --broadcast --private-key <KEY>
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        PharosPayUSD token = new PharosPayUSD();
        PharosPayLedger ledger = new PharosPayLedger(address(token));
        vm.stopBroadcast();

        console2.log("PUSD_ADDRESS=%s", address(token));
        console2.log("LEDGER_ADDRESS=%s", address(ledger));
    }
}
