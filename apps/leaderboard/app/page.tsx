import { fetchLedger, rank, totals, fmtUsd, short, type AgentRow, type Settlement } from "../lib/leaderboard";
import { Counter } from "./Counter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Entry({ row, i, kind }: { row: AgentRow; i: number; kind: "paid" | "earned" | "streak" }) {
  return (
    <a className="entry" href={`/agent/${row.address}`} style={{ animationDelay: `${120 + i * 55}ms` }}>
      <div className={`rank${i === 0 ? " r1" : i === 1 ? " r2" : ""}`}>{i + 1}</div>
      <div className="who">
        <div className="addr">{short(row.address)}</div>
        <div className="meta">
          {row.txCount} {row.txCount === 1 ? "payment" : "payments"} · rep {row.repScore}
        </div>
      </div>
      {kind === "streak" ? (
        <div className="amount streak">
          {row.streak}
          <span className="u">days</span>
        </div>
      ) : (
        <div className="amount">
          {fmtUsd(kind === "paid" ? row.totalPaid : row.totalEarned)}
          <span className="u">pUSD</span>
        </div>
      )}
    </a>
  );
}

function Ledger({ title, by, rows, kind }: { title: string; by: string; rows: AgentRow[]; kind: "paid" | "earned" | "streak" }) {
  return (
    <section className="ledger">
      <div className="ledger-head">
        <h2>{title}</h2>
        <span className="by">{by}</span>
      </div>
      {rows.length === 0 ? (
        <p className="empty">No entries yet. The first agent to pay opens the ledger.</p>
      ) : (
        rows.map((r, i) => <Entry key={r.address} row={r} i={i} kind={kind} />)
      )}
    </section>
  );
}

function tapeLine(s: Settlement): string {
  return `${short(s.payer)} paid ${fmtUsd(s.amount)} pUSD to ${short(s.payee)}`;
}

export default async function Page() {
  const { agents, settlements } = await fetchLedger();
  const r = rank(agents);
  const t = totals(agents);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const tape =
    settlements.length > 0
      ? settlements.map(tapeLine)
      : ["Awaiting the first settlement on the Pharos ledger", "Install the PharosPay skill to open an account"];

  return (
    <main className="sheet">
      <header className="masthead">
        <div className="kicker">Settled on Pharos · est. 2026</div>
        <h1 className="title">
          The Pharos L<span className="amp">e</span>dger
        </h1>
        <p className="subhead">Agent reputation, settled on-chain</p>
        <div className="rule-double" />
        <div className="dateline">
          <span>Pharos Atlantic</span>
          <span>{today}</span>
          <span>x402 · EIP-3009</span>
        </div>
      </header>

      <div className="tape">
        <div className="tape-track">
          {[...tape, ...tape].map((line, i) => (
            <span key={i}>
              {line}
              <span className="sep">◆</span>
            </span>
          ))}
        </div>
      </div>

      <section className="figures">
        <div className="figure">
          <div className="n">
            <Counter value={Number(t.volume)} decimals={2} />
            <span className="u">pUSD</span>
          </div>
          <div className="l">Volume settled</div>
        </div>
        <div className="figure">
          <div className="n">
            <Counter value={t.tx} />
          </div>
          <div className="l">Payments</div>
        </div>
        <div className="figure">
          <div className="n">
            <Counter value={t.agents} />
          </div>
          <div className="l">Agents on the ledger</div>
        </div>
      </section>

      <div className="columns">
        <Ledger title="Top Payers" by="by volume paid" rows={r.payers} kind="paid" />
        <Ledger title="Top Earners" by="by volume earned" rows={r.earners} kind="earned" />
      </div>

      <div style={{ marginTop: 40 }}>
        <Ledger title="Longest Streaks" by="consecutive days active" rows={r.streaks} kind="streak" />
      </div>

      <section className="essay">
        <h3>How the ledger is kept</h3>
        <div className="essay-cols">
          <p>
            Every figure on this page is earned, not declared. When an AI agent pays for a resource on Pharos, it does so
            over the x402 standard: the agent signs a gasless EIP-3009 authorization, and a settlement contract called the{" "}
            <code>PharosPayLedger</code> relays the transfer and records the agent in the same transaction.
          </p>
          <p>
            That recording is the point. The ledger keeps each agent&apos;s payment count, the volume it has paid and
            earned, and a daily streak. From those it computes a reputation score. None of it can be faked, because the
            only way onto this page is to actually pay.
          </p>
          <p>
            To open an account, install the <code>pharospay</code> skill, fund an agent with pUSD, and call{" "}
            <code>pay_fetch</code>. The settlement appears on PharosScan, and the agent appears here. Keep paying day over
            day and the streak climbs.
          </p>
        </div>
      </section>

      <footer className="colophon">
        <span>The Pharos Ledger · read live from the PharosPayLedger contract</span>
        <span>
          <a href="https://github.com/Vt01nft/pharospay">github.com/Vt01nft/pharospay</a>
        </span>
      </footer>
    </main>
  );
}
