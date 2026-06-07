import { createPublicClient, http, type Chain } from "viem";
import { chainById, ledgerAbi, getAddresses, type Hex } from "../../../lib/pharos";
import { fmtUsd } from "../../../lib/leaderboard";
import { Counter } from "../../Counter";

export const dynamic = "force-dynamic";

async function getStats(address: Hex) {
  try {
    const chainId = Number(process.env.PHAROS_CHAIN_ID ?? "688689");
    const rpcUrl = process.env.PHAROS_RPC_URL ?? "https://atlantic.dplabs-internal.com";
    const base = chainById(chainId);
    const chain: Chain = { ...base, rpcUrls: { default: { http: [rpcUrl] } } };
    const client = createPublicClient({ chain, transport: http(rpcUrl) });
    const st = (await client.readContract({
      address: getAddresses(chainId).ledger,
      abi: ledgerAbi,
      functionName: "stats",
      args: [address],
    })) as readonly bigint[];
    return {
      txCount: Number(st[0]),
      totalPaid: st[1].toString(),
      totalEarned: st[2].toString(),
      streak: Number(st[4]),
      repScore: Number(st[5]),
    };
  } catch {
    return null;
  }
}

export default async function AgentPage({ params }: { params: { address: string } }) {
  const address = params.address as Hex;
  const s = await getStats(address);
  const explorer = `https://testnet.pharosscan.xyz/address/${address}`;

  return (
    <main className="sheet">
      <header className="masthead">
        <div className="kicker">Agent Dossier · Pharos Ledger</div>
        <h1 className="title" style={{ fontSize: "clamp(34px,6vw,68px)" }}>
          Account
        </h1>
        <p className="subhead dossier-id">{address}</p>
        <div className="rule-double" />
        <div className="dateline">
          <span>On the ledger</span>
          <span>{s ? `reputation ${s.repScore}` : "no record"}</span>
          <span>x402 · EIP-3009</span>
        </div>
      </header>

      <section className="figures" style={{ marginTop: 34 }}>
        <div className="figure">
          <div className="n">
            <Counter value={s?.repScore ?? 0} />
          </div>
          <div className="l">Reputation</div>
        </div>
        <div className="figure">
          <div className="n">
            <Counter value={s?.streak ?? 0} />
            <span className="u">days</span>
          </div>
          <div className="l">Daily streak</div>
        </div>
        <div className="figure">
          <div className="n">
            <Counter value={s?.txCount ?? 0} />
          </div>
          <div className="l">Payments</div>
        </div>
      </section>

      <div className="columns" style={{ marginTop: 40 }}>
        <section className="ledger">
          <div className="ledger-head">
            <h2>Paid</h2>
            <span className="by">volume</span>
          </div>
          <div className="entry" style={{ animationDelay: "120ms", cursor: "default" }}>
            <div className="rank">∑</div>
            <div className="who">
              <div className="addr">total paid</div>
            </div>
            <div className="amount">
              {s ? fmtUsd(s.totalPaid) : "0"}
              <span className="u">pUSD</span>
            </div>
          </div>
        </section>
        <section className="ledger">
          <div className="ledger-head">
            <h2>Earned</h2>
            <span className="by">volume</span>
          </div>
          <div className="entry" style={{ animationDelay: "180ms", cursor: "default" }}>
            <div className="rank">∑</div>
            <div className="who">
              <div className="addr">total earned</div>
            </div>
            <div className="amount">
              {s ? fmtUsd(s.totalEarned) : "0"}
              <span className="u">pUSD</span>
            </div>
          </div>
        </section>
      </div>

      <section className="essay">
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <a className="seal" href={`/card/agent/${address}`}>
            ◆ Proof card
          </a>
          <a className="seal" href={`/?ref=${address}`}>
            ◆ Referral link
          </a>
          <a className="seal" href={explorer} target="_blank" rel="noreferrer">
            ◆ PharosScan
          </a>
        </div>
        <p style={{ fontFamily: "var(--display)", fontStyle: "italic", color: "var(--ink-2)", marginTop: 18 }}>
          A referral funds a new agent with bonus pUSD on both sides through the token&apos;s claimWithReferrer.
        </p>
      </section>

      <footer className="colophon">
        <span>
          <a href="/">← Back to the ledger</a>
        </span>
        <span>read live from PharosPayLedger</span>
      </footer>
    </main>
  );
}
