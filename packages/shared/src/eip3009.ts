import { recoverTypedDataAddress } from "viem";
import type { Account, LocalAccount } from "viem";
import { randomBytes } from "node:crypto";
import type { Authorization, Hex } from "./types";

/** EIP-712 type definition matching PharosPayUSD's TRANSFER_WITH_AUTHORIZATION_TYPEHASH. */
export const transferTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

/** EIP-712 domain. Must match the token's on-chain DOMAIN_SEPARATOR exactly. */
export function authDomain(chainId: number, token: Hex) {
  return {
    name: "PharosPay USD",
    version: "1",
    chainId,
    verifyingContract: token,
  } as const;
}

export function buildAuthorization(a: {
  from: Hex;
  to: Hex;
  value: string;
  ttlSeconds?: number;
}): Authorization {
  const now = Math.floor(Date.now() / 1000);
  return {
    from: a.from,
    to: a.to,
    value: a.value,
    validAfter: "0",
    validBefore: String(now + (a.ttlSeconds ?? 3600)),
    nonce: `0x${randomBytes(32).toString("hex")}`,
  };
}

function toMessage(auth: Authorization) {
  return {
    from: auth.from,
    to: auth.to,
    value: BigInt(auth.value),
    validAfter: BigInt(auth.validAfter),
    validBefore: BigInt(auth.validBefore),
    nonce: auth.nonce,
  };
}

export async function signAuthorization(p: {
  account: LocalAccount | Account;
  token: Hex;
  chainId: number;
  auth: Authorization;
}): Promise<Hex> {
  if (!p.account.signTypedData) throw new Error("account cannot sign typed data");
  return p.account.signTypedData({
    domain: authDomain(p.chainId, p.token),
    types: transferTypes,
    primaryType: "TransferWithAuthorization",
    message: toMessage(p.auth),
  }) as Promise<Hex>;
}

export async function recoverAuthorizationSigner(p: {
  token: Hex;
  chainId: number;
  auth: Authorization;
  signature: Hex;
}): Promise<Hex> {
  return recoverTypedDataAddress({
    domain: authDomain(p.chainId, p.token),
    types: transferTypes,
    primaryType: "TransferWithAuthorization",
    message: toMessage(p.auth),
    signature: p.signature,
  });
}
