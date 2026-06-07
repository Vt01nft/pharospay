import { createPublicClient, http, type Chain } from "viem";
import { chainById, ledgerAbi, getAddresses, type Hex } from "../../../lib/pharos";
import { fmtUsd, short } from "../../../lib/leaderboard";
import { Counter } from "../../Counter";
import { Logo } from "../../Logo";

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
    <>
      <nav className="nav">
        <div className="nav-inner">
          <a href="/">
            <Logo />
          </a>
          <div className="nav-links">
            <a className="btn btn-ghost" href="/">
              ← The Ledger
            </a>
            <a className="btn btn-primary" href="https://github.com/Vt01nft/pharospay">
              GitHub
            </a>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="eyebrow">Agent dossier · Pharos Atlantic</div>
        <h1 style={{ fontFamily: "var(--mono)", fontSize: "clamp(22px,3.4vw,38px)", letterSpacing: "-0.02em" }}>
          {short(address)}
        </h1>
        <p className="sub" style={{ fontFamily: "var(--mono)", fontSize: 14, wordBreak: "break-all" }}>{address}</p>

        <div className="stats">
          <div className="stat">
            <div className="n">
              <Counter value={s?.repScore ?? 0} />
            </div>
            <div className="l">Reputation</div>
          </div>
          <div className="stat">
            <div className="n">
              <Counter value={s?.streak ?? 0} />
              <span className="u">days</span>
            </div>
            <div className="l">Daily streak</div>
          </div>
          <div className="stat">
            <div className="n">
              <Counter value={s?.txCount ?? 0} />
            </div>
            <div className="l">Payments</div>
          </div>
        </div>
      </header>

      <main className="wrap">
        <div className="grid2" style={{ marginTop: 14 }}>
          <section className="board">
            <div className="board-head">
              <h3>Paid</h3>
              <span className="tag">volume</span>
            </div>
            <div className="row" style={{ animationDelay: "120ms" }}>
              <div className="rank">∑</div>
              <div className="who">
                <div className="addr">total paid</div>
              </div>
              <div className="amount blue">
                {s ? fmtUsd(s.totalPaid) : "0"}
                <span className="u">pUSD</span>
              </div>
            </div>
          </section>
          <section className="board">
            <div className="board-head">
              <h3>Earned</h3>
              <span className="tag">volume</span>
            </div>
            <div className="row" style={{ animationDelay: "180ms" }}>
              <div className="rank">∑</div>
              <div className="who">
                <div className="addr">total earned</div>
              </div>
              <div className="amount blue">
                {s ? fmtUsd(s.totalEarned) : "0"}
                <span className="u">pUSD</span>
              </div>
            </div>
          </section>
        </div>

        <div className="pillrow" style={{ marginTop: 24 }}>
          <a className="pill solid" href={`/card/agent/${address}`}>
            Proof card
          </a>
          <a className="pill" href={`/?ref=${address}`}>
            Referral link
          </a>
          <a className="pill" href={explorer} target="_blank" rel="noreferrer">
            View on PharosScan
          </a>
        </div>
        <p style={{ color: "var(--ink-2)", fontSize: 14.5, marginTop: 18, maxWidth: "60ch" }}>
          A referral funds a new agent with bonus pUSD on both sides through the token&apos;s claimWithReferrer.
        </p>
      </main>

      <footer className="footer">
        <a href="/">← Back to the ledger</a>
        <span>read live from the PharosPayLedger contract</span>
      </footer>
    </>
  );
}
