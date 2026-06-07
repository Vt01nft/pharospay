#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getAddresses, type Hex } from "@pharospay/shared";
import { PayClient } from "./payClient";
import { Store } from "./store";
import { buildToolDefs } from "./tools";

const chainId = Number(process.env.PHAROS_CHAIN_ID ?? "688688");
const rpcUrl = process.env.PHAROS_RPC_URL ?? "https://testnet.dplabs-internal.com";
const network = process.env.PHAROS_NETWORK ?? "pharos-testnet";
const pk = process.env.PHAROSPAY_PRIVATE_KEY as Hex | undefined;

if (!pk) {
  console.error("PHAROSPAY_PRIVATE_KEY is required");
  process.exit(1);
}

const { pusd } = getAddresses(chainId);
const store = new Store();
const client = new PayClient({ privateKey: pk, chainId, rpcUrl, token: pusd, network, store });

const server = new McpServer({ name: "pharospay", version: "0.1.0" });
for (const t of buildToolDefs({ client, store })) {
  server.tool(t.name, t.description, t.schema, t.handler as never);
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("PharosPay MCP skill running on stdio");
