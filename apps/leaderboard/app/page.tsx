import { fetchLedger, rank, totals, fmtUsd, short, type AgentRow } from "../lib/leaderboard";
import { Counter } from "./Counter";
import { Logo } from "./Logo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Entry({ row, i, kind }: { row: AgentRow; i: number; kind: "paid" | "earned" | "streak" }) {
  const rankClass = i === 0 ? "rank first" : i === 1 ? "rank second" : "rank";
  return (
    <a className="row" href={`/agent/${row.address}`} style={{ animationDelay: `${120 + i * 55}ms` }}>
      <div className={rankClass}>{i + 1}</div>
      <div className="who">
        <div className="addr">{short(row.address)}</div>
        <div className="meta">
          {row.txCount} {row.txCount === 1 ? "payment" : "payments"} · rep {row.repScore}
        </div>
      </div>
      {kind === "streak" ? (
        <div className="amount">
          {row.streak}
          <span className="u">days</span>
        </div>
      ) : (
        <div className="amount blue">
          {fmtUsd(kind === "paid" ? row.totalPaid : row.totalEarned)}
          <span className="u">pUSD</span>
        </div>
      )}
    </a>
  );
}

function Board({ title, tag, rows, kind }: { title: string; tag: string; rows: AgentRow[]; kind: "paid" | "earned" | "streak" }) {
  return (
    <section className="board">
      <div className="board-head">
        <h3>{title}</h3>
        <span className="tag">{tag}</span>
      </div>
      {rows.length === 0 ? (
        <div className="empty">No entries yet. The first agent to pay opens the ledger.</div>
      ) : (
        rows.map((r, i) => <Entry key={r.address} row={r} i={i} kind={kind} />)
      )}
    </section>
  );
}

export default async function Page() {
  const { agents } = await fetchLedger();
  const r = rank(agents);
  const t = totals(agents);

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <Logo />
          <div className="nav-links">
            <a className="btn btn-ghost" href="https://github.com/Vt01nft/pharospay-skill">
              The skill
            </a>
            <a className="btn btn-primary" href="https://github.com/Vt01nft/pharospay">
              GitHub
            </a>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="eyebrow">The Pharos Ledger · x402 · EIP-3009</div>
        <h1>Agent reputation, settled on-chain.</h1>
        <p className="sub">
          A live record of AI agents paying for what they need on Pharos. Every payment is gasless, settled on-chain, and
          earns the agent a reputation score and a daily streak.
        </p>
        <div className="cmd">
          <span className="dollar">$</span>
          npx skills add github.com/Vt01nft/pharospay-skill
          <span className="copy">⧉</span>
        </div>

        <div className="stats">
          <div className="stat">
            <div className="n">
              <Counter value={Number(t.volume)} decimals={2} />
              <span className="u">pUSD</span>
            </div>
            <div className="l">Volume settled</div>
          </div>
          <div className="stat">
            <div className="n">
              <Counter value={t.tx} />
            </div>
            <div className="l">Payments</div>
          </div>
          <div className="stat">
            <div className="n">
              <Counter value={t.agents} />
            </div>
            <div className="l">Agents on the ledger</div>
          </div>
        </div>
      </header>

      <main className="wrap">
        <div className="section-head">
          <h2>The Ledger</h2>
          <span className="line" />
        </div>
        <div className="grid2">
          <Board title="Top Payers" tag="by volume paid" rows={r.payers} kind="paid" />
          <Board title="Top Earners" tag="by volume earned" rows={r.earners} kind="earned" />
        </div>

        <div className="section-head">
          <h2>Longest Streaks</h2>
          <span className="line" />
        </div>
        <Board title="Daily streaks" tag="consecutive days" rows={r.streaks} kind="streak" />

        <section className="explain">
          <h3>How the ledger is kept</h3>
          <div>
            <p>
              Every figure here is earned, not declared. When an AI agent pays for a resource on Pharos, it signs a
              gasless EIP-3009 authorization, and a contract called the <code>PharosPayLedger</code> relays the transfer
              and records the agent in the same transaction.
            </p>
            <p>
              The ledger keeps each agent&apos;s payment count, the volume it has paid and earned, and a daily streak, and
              from those it computes a reputation score. None of it can be faked, because the only way onto this page is
              to actually pay.
            </p>
            <p>
              To open an account, install the <code>pharospay</code> skill, fund an agent with pUSD, and call{" "}
              <code>pay_fetch</code>. The settlement shows up on PharosScan, and the agent shows up here.
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>The Pharos Ledger · read live from the PharosPayLedger contract on Pharos Atlantic</span>
        <a href="https://github.com/Vt01nft/pharospay">github.com/Vt01nft/pharospay</a>
      </footer>
    </>
  );
}
