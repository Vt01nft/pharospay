import { describe, it, expect } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";
import { build402Body, verifyPayment } from "../src/lib/x402";
import type { Hex, PaymentPayload } from "../src/lib/pharos";

const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const token = "0x0000000000000000000000000000000000000abc" as Hex;
const merchant = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as Hex;
const chainId = 31337;
const network = "anvil-local";

const types = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

async function signedPayload(over?: { value?: string; network?: string }): Promise<PaymentPayload> {
  const account = privateKeyToAccount(PK);
  const now = Math.floor(Date.now() / 1000);
  const auth = {
    from: account.address,
    to: merchant,
    value: over?.value ?? "10000",
    validAfter: "0",
    validBefore: String(now + 3600),
    nonce: ("0x" + randomBytes(32).toString("hex")) as Hex,
  };
  const signature = await account.signTypedData({
    domain: { name: "PharosPay USD", version: "1", chainId, verifyingContract: token },
    types,
    primaryType: "TransferWithAuthorization",
    message: { from: auth.from, to: auth.to, value: BigInt(auth.value), validAfter: 0n, validBefore: BigInt(auth.validBefore), nonce: auth.nonce },
  });
  return { x402Version: 1, scheme: "exact", network: over?.network ?? network, asset: token, authorization: auth, signature };
}

describe("alpha-api x402", () => {
  const req = build402Body({ price: "0.01", payTo: merchant, asset: token, network, resource: "/alpha/wallet/x", description: "x" }).accepts[0];

  it("builds a 402 with base units", () => {
    expect(req.maxAmountRequired).toBe("10000");
    expect(req.payTo).toBe(merchant);
  });
  it("accepts a valid signed payment", async () => {
    expect(await verifyPayment(await signedPayload(), req, chainId)).toEqual({ ok: true });
  });
  it("rejects an insufficient amount", async () => {
    expect((await verifyPayment(await signedPayload({ value: "9999" }), req, chainId)).reason).toBe("insufficient amount");
  });
  it("rejects the wrong network", async () => {
    expect((await verifyPayment(await signedPayload({ network: "other" }), req, chainId)).reason).toBe("wrong network");
  });
});
