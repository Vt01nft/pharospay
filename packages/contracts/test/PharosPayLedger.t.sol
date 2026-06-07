// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/PharosPayUSD.sol";
import "../src/PharosPayLedger.sol";

contract PharosPayLedgerTest is Test {
    PharosPayUSD t;
    PharosPayLedger ledger;
    uint256 alicePk = 0xA11CE;
    address alice;
    address bob = address(0xB0B);

    function setUp() public {
        t = new PharosPayUSD();
        ledger = new PharosPayLedger(address(t));
        alice = vm.addr(alicePk);
        vm.prank(alice);
        t.claim();
    }

    function _auth(uint256 value, bytes32 nonce)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s, uint256 va, uint256 vb)
    {
        va = 0;
        vb = block.timestamp + 1 hours;
        bytes32 structHash =
            keccak256(abi.encode(t.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), alice, bob, value, va, vb, nonce));
        bytes32 d = keccak256(abi.encodePacked("\x19\x01", t.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(alicePk, d);
    }

    function test_settle_relays_and_records() public {
        (uint8 v, bytes32 r, bytes32 s, uint256 va, uint256 vb) = _auth(10e6, keccak256("n1"));
        ledger.settle(alice, bob, 10e6, va, vb, keccak256("n1"), v, r, s, keccak256("GET /alpha"));

        assertEq(t.balanceOf(bob), 10e6);

        (uint256 txc, uint256 paid,,, uint256 streak,) = ledger.stats(alice);
        assertEq(txc, 1);
        assertEq(paid, 10e6);
        assertEq(streak, 1);

        (,, uint256 earned,,,) = ledger.stats(bob);
        assertEq(earned, 10e6);
    }

    function test_streak_increments_next_day() public {
        (uint8 v, bytes32 r, bytes32 s, uint256 va, uint256 vb) = _auth(1e6, keccak256("d1"));
        ledger.settle(alice, bob, 1e6, va, vb, keccak256("d1"), v, r, s, bytes32(0));

        vm.warp(block.timestamp + 1 days);
        (v, r, s, va, vb) = _auth(1e6, keccak256("d2"));
        ledger.settle(alice, bob, 1e6, va, vb, keccak256("d2"), v, r, s, bytes32(0));

        (uint256 txc,,,, uint256 streak,) = ledger.stats(alice);
        assertEq(txc, 2);
        assertEq(streak, 2);
    }

    function test_emits_PaymentSettled() public {
        (uint8 v, bytes32 r, bytes32 s, uint256 va, uint256 vb) = _auth(7e6, keccak256("e1"));
        vm.expectEmit(true, true, false, true);
        emit PharosPayLedger.PaymentSettled(alice, bob, 7e6, keccak256("res"), block.timestamp);
        ledger.settle(alice, bob, 7e6, va, vb, keccak256("e1"), v, r, s, keccak256("res"));
    }
}
