export type Hex = `0x${string}`;

/** x402 payment requirements advertised in a 402 response. */
export interface PaymentRequirements {
  scheme: "exact";
  network: string;
  maxAmountRequired: string; // base units (6 decimals for pUSD)
  asset: Hex;
  payTo: Hex;
  resource: string;
  description: string;
  mimeType: string;
  maxTimeoutSeconds: number;
}

export interface PaymentRequired {
  x402Version: number;
  accepts: PaymentRequirements[];
}

/** EIP-3009 TransferWithAuthorization message. */
export interface Authorization {
  from: Hex;
  to: Hex;
  value: string; // base units
  validAfter: string;
  validBefore: string;
  nonce: Hex; // bytes32
}

/** Encoded into the X-PAYMENT header (base64 JSON). */
export interface PaymentPayload {
  x402Version: number;
  scheme: "exact";
  network: string;
  asset: Hex;
  authorization: Authorization;
  signature: Hex;
}

/** Returned in X-PAYMENT-RESPONSE after settlement. */
export interface PaymentResponse {
  success: boolean;
  txHash?: Hex;
  network: string;
  error?: string;
}
