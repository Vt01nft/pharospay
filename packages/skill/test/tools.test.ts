import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/store";
import { PayClient } from "../src/payClient";
import { buildToolDefs, type ToolDef } from "../src/tools";

const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;

function setup() {
  const store = new Store(join(tmpdir(), `pp-tools-${Math.random().toString(36).slice(2)}.json`));
  const client = new PayClient({
    privateKey: PK,
    chainId: 31337,
    rpcUrl: "http://127.0.0.1:1",
    token: "0x0000000000000000000000000000000000000abc",
    store,
  });
  return { list: buildToolDefs({ client, store, leaderboardUrl: "https://lb.test" }), store, client };
}

const find = (list: ToolDef[], name: string) => list.find((t) => t.name === name)!;
const parse = (r: { content: { text: string }[] }) => JSON.parse(r.content[0].text);

describe("tool defs", () => {
  it("exposes the composable tool set", () => {
    const { list } = setup();
    expect(list.map((t) => t.name).sort()).toEqual([
      "get_balance",
      "get_budget",
      "get_referral_link",
      "get_reputation",
      "get_wallet",
      "list_receipts",
      "pay_fetch",
      "set_budget",
      "share_receipt",
    ]);
  });

  it("get_wallet returns the agent address", async () => {
    const { list, client } = setup();
    const res = await find(list, "get_wallet").handler({});
    expect(parse(res).address.toLowerCase()).toBe(client.address.toLowerCase());
  });

  it("set_budget converts human pUSD to base units", async () => {
    const { list } = setup();
    const res = await find(list, "set_budget").handler({ perCallMax: "0.05" });
    expect(parse(res).perCallMax).toBe("50000");
  });

  it("list_receipts starts empty", async () => {
    const { list } = setup();
    const res = await find(list, "list_receipts").handler({});
    expect(parse(res)).toEqual([]);
  });

  it("share_receipt builds explorer card URLs", async () => {
    const { list, client } = setup();
    const withTx = parse(await find(list, "share_receipt").handler({ txHash: "0xabc" }));
    expect(withTx.cardUrl).toBe("https://lb.test/card/receipt/0xabc");
    const profile = parse(await find(list, "share_receipt").handler({}));
    expect(profile.cardUrl).toBe(`https://lb.test/card/agent/${client.address}`);
  });

  it("get_referral_link embeds the agent address", async () => {
    const { list, client } = setup();
    const res = parse(await find(list, "get_referral_link").handler({}));
    expect(res.url).toBe(`https://lb.test/?ref=${client.address}`);
  });
});
