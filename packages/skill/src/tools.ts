import { z } from "zod";
import { parseUnits } from "viem";
import type { PayClient } from "./payClient";
import type { Store } from "./store";

export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export interface ToolDef {
  name: string;
  description: string;
  schema: Record<string, z.ZodTypeAny>;
  handler: (args: any) => Promise<ToolResult>;
}

function ok(obj: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}
function fail(msg: string): ToolResult {
  return { content: [{ type: "text", text: msg }], isError: true };
}

const toBase = (human: string) => parseUnits(human, 6).toString();

/** Build the composable PharosPay tool set. */
export function buildToolDefs(deps: { client: PayClient; store: Store }): ToolDef[] {
  const { client, store } = deps;
  return [
    {
      name: "pay_fetch",
      description:
        "Fetch a URL. If it responds 402 Payment Required, automatically pay via x402 on Pharos (within budget guardrails) and return the resource.",
      schema: {
        url: z.string().url(),
        method: z.string().optional(),
        body: z.string().optional(),
        maxAmount: z.string().optional().describe("Max pUSD to spend on this call (human units, e.g. '0.05')."),
      },
      handler: async (a) => {
        try {
          return ok(await client.payFetch(a));
        } catch (e) {
          return fail(`pay_fetch error: ${(e as Error).message}`);
        }
      },
    },
    {
      name: "get_wallet",
      description: "Return the agent's wallet address and the Pharos chain id it pays on.",
      schema: {},
      handler: async () => ok({ address: client.address, chainId: client.chainId }),
    },
    {
      name: "get_balance",
      description: "Return the agent's pUSD and native PHRS balances.",
      schema: {},
      handler: async () => {
        try {
          return ok(await client.getBalance());
        } catch (e) {
          return fail(`get_balance error: ${(e as Error).message}`);
        }
      },
    },
    {
      name: "set_budget",
      description:
        "Set spending guardrails. perCallMax/dailyCap are in pUSD human units ('0' = unlimited). allowlist/denylist are hostnames.",
      schema: {
        perCallMax: z.string().optional(),
        dailyCap: z.string().optional(),
        allowlist: z.array(z.string()).optional(),
        denylist: z.array(z.string()).optional(),
      },
      handler: async (a) => {
        const patch: Record<string, unknown> = {};
        if (a.perCallMax !== undefined) patch.perCallMax = a.perCallMax === "0" ? "0" : toBase(a.perCallMax);
        if (a.dailyCap !== undefined) patch.dailyCap = a.dailyCap === "0" ? "0" : toBase(a.dailyCap);
        if (a.allowlist !== undefined) patch.allowlist = a.allowlist;
        if (a.denylist !== undefined) patch.denylist = a.denylist;
        return ok(store.setBudget(patch));
      },
    },
    {
      name: "get_budget",
      description: "Show current guardrails and how much has been spent today (base units).",
      schema: {},
      handler: async () => ok({ budget: store.getBudget(), spentTodayRaw: store.getSpentToday().toString() }),
    },
    {
      name: "list_receipts",
      description: "List recent on-chain payment receipts (each includes a Pharos tx hash).",
      schema: { limit: z.number().optional() },
      handler: async (a) => ok(store.listReceipts(a?.limit ?? 20)),
    },
  ];
}
