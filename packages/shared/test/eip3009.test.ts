import { describe, it, expect } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { buildAuthorization, signAuthorization, recoverAuthorizationSigner } from "../src/eip3009";

// anvil default account #1 private key
const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;

describe("eip3009", () => {
  it("signs and recovers the signer", async () => {
    const acct = privateKeyToAccount(PK);
    const token = "0x0000000000000000000000000000000000000001" as const;
    const auth = buildAuthorization({
      from: acct.address,
      to: "0x00000000000000000000000000000000000000b0",
      value: "10000000",
    });
    const sig = await signAuthorization({ account: acct, token, chainId: 31337, auth });
    const signer = await recoverAuthorizationSigner({ token, chainId: 31337, auth, signature: sig });
    expect(signer.toLowerCase()).toBe(acct.address.toLowerCase());
  });

  it("recovers a different signer for tampered amount", async () => {
    const acct = privateKeyToAccount(PK);
    const token = "0x0000000000000000000000000000000000000001" as const;
    const auth = buildAuthorization({
      from: acct.address,
      to: "0x00000000000000000000000000000000000000b0",
      value: "10000000",
    });
    const sig = await signAuthorization({ account: acct, token, chainId: 31337, auth });
    const tampered = { ...auth, value: "99999999" };
    const signer = await recoverAuthorizationSigner({ token, chainId: 31337, auth: tampered, signature: sig });
    expect(signer.toLowerCase()).not.toBe(acct.address.toLowerCase());
  });
});
