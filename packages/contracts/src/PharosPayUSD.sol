// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP3009} from "./lib/EIP3009.sol";

/// @title PharosPay USD (pUSD)
/// @notice EIP-3009 testnet stablecoin that makes Pharos x402-settleable.
/// @dev Public faucet with cooldown + referral bonus growth loop.
contract PharosPayUSD is EIP3009 {
    uint256 public constant FAUCET_AMOUNT = 100e6; // 100 pUSD
    uint256 public constant REFERRAL_BONUS = 25e6; // 25 pUSD to each side
    uint256 public constant COOLDOWN = 12 hours;
    uint256 public constant REFERRAL_CAP = 50; // max counted referrals per referrer

    mapping(address => uint256) public lastClaim;
    mapping(address => uint256) public referralCount;

    constructor() ERC20("PharosPay USD", "pUSD") EIP3009("PharosPay USD", "1") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint the faucet amount to the caller (subject to cooldown).
    function claim() public {
        require(lastClaim[msg.sender] == 0 || block.timestamp - lastClaim[msg.sender] >= COOLDOWN, "cooldown");
        lastClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Claim and credit a referrer; both sides receive a bonus.
    function claimWithReferrer(address referrer) external {
        claim();
        if (referrer != address(0) && referrer != msg.sender && referralCount[referrer] < REFERRAL_CAP) {
            referralCount[referrer] += 1;
            _mint(referrer, REFERRAL_BONUS);
            _mint(msg.sender, REFERRAL_BONUS);
        }
    }
}
