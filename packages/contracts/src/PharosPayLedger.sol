// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IEIP3009 {
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

/// @title PharosPayLedger
/// @notice Settlement relay for x402 payments on Pharos. Relays an EIP-3009
///         authorization to the token and records per-agent reputation/streak
///         data, so reputation is produced on every payment with no extra tx.
contract PharosPayLedger {
    IEIP3009 public immutable token;

    struct Stats {
        uint256 txCount;
        uint256 totalPaid;
        uint256 totalEarned;
        uint256 lastActiveDay;
        uint256 streak;
        uint256 repScore;
    }

    mapping(address => Stats) public stats;

    event PaymentSettled(
        address indexed payer, address indexed payee, uint256 amount, bytes32 resourceHash, uint256 ts
    );

    constructor(address token_) {
        token = IEIP3009(token_);
    }

    /// @notice Relay a signed EIP-3009 authorization and record reputation.
    function settle(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s,
        bytes32 resourceHash
    ) external {
        token.transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s);

        _recordPayer(from, value);

        Stats storage payee = stats[to];
        payee.totalEarned += value;
        payee.repScore = _score(payee);

        emit PaymentSettled(from, to, value, resourceHash, block.timestamp);
    }

    function _recordPayer(address payer, uint256 value) internal {
        Stats storage st = stats[payer];
        uint256 day = block.timestamp / 1 days;

        if (st.streak == 0) {
            st.streak = 1; // first activity ever
        } else if (day == st.lastActiveDay + 1) {
            st.streak += 1; // consecutive day
        } else if (day != st.lastActiveDay) {
            st.streak = 1; // gap -> reset
        } // same day -> unchanged

        st.lastActiveDay = day;
        st.txCount += 1;
        st.totalPaid += value;
        st.repScore = _score(st);
    }

    function _score(Stats storage st) internal view returns (uint256) {
        // txCount + (earned in whole pUSD) + streak bonus
        return st.txCount + (st.totalEarned / 1e6) + st.streak * 5;
    }
}
