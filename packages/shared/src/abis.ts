/** Minimal ABIs for the PharosPay contracts (viem-typed). */

export const pusdAbi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "referralCount", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "claimWithReferrer", stateMutability: "nonpayable", inputs: [{ name: "referrer", type: "address" }], outputs: [] },
  {
    type: "function",
    name: "transferWithAuthorization",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

export const ledgerAbi = [
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
      { name: "resourceHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "stats",
    stateMutability: "view",
    inputs: [{ name: "a", type: "address" }],
    outputs: [
      { name: "txCount", type: "uint256" },
      { name: "totalPaid", type: "uint256" },
      { name: "totalEarned", type: "uint256" },
      { name: "lastActiveDay", type: "uint256" },
      { name: "streak", type: "uint256" },
      { name: "repScore", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "PaymentSettled",
    inputs: [
      { name: "payer", type: "address", indexed: true },
      { name: "payee", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "resourceHash", type: "bytes32", indexed: false },
      { name: "ts", type: "uint256", indexed: false },
    ],
  },
] as const;
