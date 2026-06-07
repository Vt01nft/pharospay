import { it, expect } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PayClient } from "../src/payClient";
import { Store } from "../src/store";
import { buildToolDefs } from "../src/tools";

const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;

it("registers all tools on a real McpServer (matches server.ts wiring)", () => {
  const store = new Store(join(tmpdir(), `pp-smoke-${Math.random().toString(36).slice(2)}.json`));
  const client = new PayClient({
    privateKey: PK,
    chainId: 31337,
    rpcUrl: "http://127.0.0.1:1",
    token: "0x0000000000000000000000000000000000000abc",
    store,
  });
  const server = new McpServer({ name: "pharospay", version: "0.1.0" });

  expect(() => {
    for (const t of buildToolDefs({ client, store })) {
      server.tool(t.name, t.description, t.schema, t.handler as never);
    }
  }).not.toThrow();
});
