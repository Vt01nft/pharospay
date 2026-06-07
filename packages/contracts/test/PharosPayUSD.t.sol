// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/PharosPayUSD.sol";

contract PharosPayUSDTest is Test {
    PharosPayUSD t;
    uint256 alicePk = 0xA11CE;
    address alice;
    address bob = address(0xB0B);

    function setUp() public {
        t = new PharosPayUSD();
        alice = vm.addr(alicePk);
    }

    function test_claim_mints_and_cooldown() public {
        vm.prank(alice);
        t.claim();
        assertEq(t.balanceOf(alice), t.FAUCET_AMOUNT());

        vm.prank(alice);
        vm.expectRevert(bytes("cooldown"));
        t.claim();

        // after cooldown, claim again
        vm.warp(block.timestamp + t.COOLDOWN());
        vm.prank(alice);
        t.claim();
        assertEq(t.balanceOf(alice), 2 * t.FAUCET_AMOUNT());
    }

    function test_referral_bonus_and_cap() public {
        vm.prank(bob);
        t.claimWithReferrer(alice);
        assertEq(t.referralCount(alice), 1);
        assertEq(t.balanceOf(alice), t.REFERRAL_BONUS());
        assertEq(t.balanceOf(bob), t.FAUCET_AMOUNT() + t.REFERRAL_BONUS());
    }

    function _sign(uint256 pk, address from, address to, uint256 value, bytes32 nonce)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s, uint256 va, uint256 vb)
    {
        va = 0;
        vb = block.timestamp + 1 hours;
        bytes32 structHash =
            keccak256(abi.encode(t.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), from, to, value, va, vb, nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", t.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(pk, digest);
    }

    function test_transferWithAuthorization_and_replay() public {
        vm.prank(alice);
        t.claim();
        bytes32 nonce = keccak256("n1");
        (uint8 v, bytes32 r, bytes32 s, uint256 va, uint256 vb) = _sign(alicePk, alice, bob, 10e6, nonce);

        t.transferWithAuthorization(alice, bob, 10e6, va, vb, nonce, v, r, s);
        assertEq(t.balanceOf(bob), 10e6);
        assertEq(t.balanceOf(alice), t.FAUCET_AMOUNT() - 10e6);

        // replay must fail
        vm.expectRevert(bytes("auth used"));
        t.transferWithAuthorization(alice, bob, 10e6, va, vb, nonce, v, r, s);
    }

    function test_transferWithAuthorization_expired() public {
        vm.prank(alice);
        t.claim();
        bytes32 nonce = keccak256("n2");
        bytes32 structHash =
            keccak256(abi.encode(t.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), alice, bob, 5e6, uint256(0), uint256(1), nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", t.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(alicePk, digest);

        vm.warp(100);
        vm.expectRevert(bytes("auth expired"));
        t.transferWithAuthorization(alice, bob, 5e6, 0, 1, nonce, v, r, s);
    }
}
