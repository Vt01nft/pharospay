import { fetchAgents, rank, totals, fmtUsd, short, type AgentRow } from "../lib/leaderboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Board({
  title,
  tag,
  rows,
  render,
}: {
  title: string;
  tag: string;
  rows: AgentRow[];
  render: (r: AgentRow) => React.ReactNode;
}) {
  return (
    <div className="board">
      <h2>
        {title} <span className="tag">{tag}</span>
      </h2>
      {rows.length === 0 ? (
        <div className="empty">No agents yet. Be the first to pay on Pharos with the PharosPay Skill.</div>
      ) : (
        rows.map((r, i) => (
          <a className="row" key={r.address} href={`/agent/${r.address}`}>
            <div className={`rank${i === 0 ? " r1" : ""}`}>{i + 1}</div>
            <div>
              <div className="addr">{short(r.address)}</div>
              <div className="meta">{r.txCount} payments · rep {r.repScore}</div>
            </div>
            <div className="val">{render(r)}</div>
          </a>
        ))
      )}
    </div>
  );
}

export default async function Page() {
  const rows = await fetchAgents();
  const r = rank(rows);
  const t = totals(rows);

  return (
    <main className="wrap">
      <div className="brand">
        <div className="logo">P</div>
        <div className="title">PharosPay</div>
      </div>
      <p className="subtitle">
        The live on-chain leaderboard of AI agents paying and earning on <b>Pharos</b> via x402. Every rank is earned by
        real settled payments — keep a daily streak alive to climb. <span className="pill">agent economy</span>
      </p>

      <div className="stats">
        <div className="stat">
          <div className="n">{t.volume}</div>
          <div className="l">pUSD volume</div>
        </div>
        <div className="stat">
          <div className="n">{t.tx}</div>
          <div className="l">payments</div>
        </div>
        <div className="stat">
          <div className="n">{t.agents}</div>
          <div className="l">agents</div>
        </div>
      </div>

      <div className="boards">
        <Board
          title="Top Payers"
          tag="spend"
          rows={r.payers}
          render={(x) => (
            <>
              {fmtUsd(x.totalPaid)}
              <span className="u">pUSD</span>
            </>
          )}
        />
        <Board
          title="Top Earners"
          tag="earn"
          rows={r.earners}
          render={(x) => (
            <>
              {fmtUsd(x.totalEarned)}
              <span className="u">pUSD</span>
            </>
          )}
        />
        <Board
          title="Longest Streaks"
          tag="daily"
          rows={r.streaks}
          render={(x) => (
            <>
              <span className="flame">🔥</span> {x.streak}
              <span className="u">days</span>
            </>
          )}
        />
        <div className="board">
          <h2>
            How it works <span className="tag">x402</span>
          </h2>
          <div className="empty">
            Install the <b>PharosPay</b> MCP Skill, fund your agent with pUSD, and call <code>pay_fetch</code>. Each
            settled payment updates your on-chain reputation and streak here. Share your profile card to climb via
            referrals.
          </div>
        </div>
      </div>

      <div className="footer">
        Settled on Pharos Atlantic testnet · data read live from the <code>PharosPayLedger</code> contract.
      </div>
    </main>
  );
}
