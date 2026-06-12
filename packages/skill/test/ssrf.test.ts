import { describe, it, expect } from "vitest";
import { PayClient, assertSafeUrl } from "../src/payClient";

const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const TOKEN = "0x0000000000000000000000000000000000000abc" as const;

function client() {
  return new PayClient({ privateKey: PK, chainId: 31337, rpcUrl: "http://example.com", token: TOKEN });
}

function fakeResponse(status: number, location?: string): Response {
  return {
    status,
    headers: { get: (h: string) => (h.toLowerCase() === "location" ? location ?? null : null) },
  } as unknown as Response;
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
    "http://[::ffff:127.0.0.1]/x", // IPv4-mapped IPv6
    "http://0x7f000001/x", // hex form of 127.0.0.1
    "http://2130706433/x", // decimal form of 127.0.0.1
    "http://0177.0.0.1/x", // octal form of 127.0.0.1
    "file:///etc/passwd",
    "gopher://internal/x",
  ];
  for (const url of blocked) {
    it(`payFetch refuses ${url}`, async () => {
      await expect(client().payFetch({ url })).rejects.toThrow();
    });
  }

  it("re-checks the guard on redirects (refuses a 3xx to an internal address)", async () => {
    const c = new PayClient({
      privateKey: PK,
      chainId: 31337,
      rpcUrl: "http://example.com",
      token: TOKEN,
      fetchImpl: async () => fakeResponse(302, "http://169.254.169.254/latest/meta-data/"),
    });
    await expect(c.payFetch({ url: "https://example.com/resource" })).rejects.toThrow();
  });

  it("allows a normal public https url", () => {
    expect(() => assertSafeUrl("https://alpha-api-seven.vercel.app/alpha/wallet/0xabc")).not.toThrow();
  });
});
