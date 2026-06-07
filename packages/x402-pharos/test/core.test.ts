import { describe, it, expect } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { buildAuthorization, signAuthorization, type Hex, type PaymentPayload } from "@pharospay/shared";
import { build402Body, verifyPayment } from "../src/core";

const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const token = "0x0000000000000000000000000000000000000abc" as Hex;
const merchant = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as Hex;
const chainId = 31337;
const network = "anvil-local";

async function makePayload(opts?: { value?: string; to?: Hex; network?: string }): Promise<PaymentPayload> {
  const account = privateKeyToAccount(PK);
  const auth = buildAuthorization({ from: account.address, to: opts?.to ?? merchant, value: opts?.value ?? "10000" });
  const signature = await signAuthorization({ account, token, chainId, auth });
  return { x402Version: 1, scheme: "exact", network: opts?.network ?? network, asset: token, authorization: auth, signature };
}

describe("build402Body", () => {
  it("converts price to base units (6 decimals)", () => {
    const body = build402Body({
      price: "0.01", payTo: merchant, asset: token, network, resource: "/alpha", description: "x",
    });
    expect(body.x402Version).toBe(1);
    expect(body.accepts[0].maxAmountRequired).toBe("10000");
    expect(body.accepts[0].payTo).toBe(merchant);
    expect(body.accepts[0].scheme).toBe("exact");
  });
});

describe("verifyPayment", () => {
  const req = build402Body({ price: "0.01", payTo: merchant, asset: token, network, resource: "/alpha", description: "x" }).accepts[0];

  it("accepts a valid signed payload", async () => {
    const payload = await makePayload();
    expect(await verifyPayment(payload, req, chainId)).toEqual({ ok: true });
  });

  it("rejects wrong payTo", async () => {
    const payload = await makePayload({ to: "0x000000000000000000000000000000000000dEaD" });
    expect((await verifyPayment(payload, req, chainId)).reason).toBe("wrong payTo");
  });

  it("rejects insufficient amount", async () => {
    const payload = await makePayload({ value: "9999" });
    expect((await verifyPayment(payload, req, chainId)).reason).toBe("insufficient amount");
  });

  it("rejects wrong network", async () => {
    const payload = await makePayload({ network: "some-other-net" });
    expect((await verifyPayment(payload, req, chainId)).reason).toBe("wrong network");
  });
});
