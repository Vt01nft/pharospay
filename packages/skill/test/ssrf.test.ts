import { describe, it, expect } from "vitest";
import { PayClient, assertSafeUrl } from "../src/payClient";

const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;

function client() {
  return new PayClient({
    privateKey: PK,
    chainId: 31337,
    rpcUrl: "http://example.com",
    token: "0x0000000000000000000000000000000000000abc",
  });
}

describe("SSRF guard (CWE-918)", () => {
  const blocked = [
    "http://169.254.169.254/latest/meta-data/", // cloud metadata
    "http://localhost:8080/x",
    "http://127.0.0.1/x",
    "http://10.0.0.5/x",
    "http://192.168.1.1/x",
    "http://172.16.0.1/x",
    "http://[::1]/x",
    "file:///etc/passwd",
    "gopher://internal/x",
  ];
  for (const url of blocked) {
    it(`payFetch refuses ${url}`, async () => {
      await expect(client().payFetch({ url })).rejects.toThrow();
    });
  }

  it("allows a normal public https url", () => {
    expect(() => assertSafeUrl("https://alpha-api-seven.vercel.app/alpha/wallet/0xabc")).not.toThrow();
  });
});
