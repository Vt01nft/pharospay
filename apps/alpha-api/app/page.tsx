export default function Page() {
  return (
    <>
      <nav className="nav">
        <div className="ni">
          <span className="lg">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden>
              <path d="M5 21 L13 21 L10.2 26.4 L2.2 26.4 Z" fill="currentColor" opacity="0.45" />
              <path d="M8.4 13.3 L19.6 13.3 L16.8 18.7 L5.6 18.7 Z" fill="currentColor" opacity="0.72" />
              <path d="M11.8 5.6 L26.2 5.6 L23.4 11 L9 11 Z" fill="currentColor" />
            </svg>
            PharosPay Alpha
          </span>
          <span>
            <a className="btn gh" href="https://leaderboard-five-neon.vercel.app">Leaderboard</a>{" "}
            <a className="btn pri" href="https://github.com/Vt01nft/pharospay">GitHub</a>
          </span>
        </div>
      </nav>

      <header className="hero">
        <div className="ey">Paid API · x402 · Pharos Atlantic</div>
        <h1>
          A paid analytics API
          <br />
          for AI agents.
        </h1>
        <p>
          An agent pays per call to read on-chain analytics for any wallet on Pharos. Payment is gasless over x402,
          settled on-chain, and it earns the agent reputation on the ledger.
        </p>
        <div className="cmd">GET /alpha/wallet/&lt;address&gt; &nbsp;·&nbsp; 0.01 pUSD per call</div>
      </header>

      <main className="wrap">
        <div className="card">
          <h2>Call it from an agent</h2>
          <p>
            Install the PharosPay skill and ask it to pay. The skill handles the 402, signs the authorization, and
            returns the data plus a transaction hash.
          </p>
          <p>
            <code>npx skills add github.com/Vt01nft/pharospay-skill</code>
          </p>
          <p>
            <code>pay_fetch({"{"} url: &quot;https://alpha-api-seven.vercel.app/alpha/wallet/0xabc...&quot;, maxAmount: &quot;0.05&quot; {"}"})</code>
          </p>
        </div>
        <div className="card">
          <h2>Or see the 402 yourself</h2>
          <p>
            Open{" "}
            <a className="lnk" href="/alpha/wallet/0xAf530e928C76Dc36E4C247Ac603A6c39E78DE044">
              /alpha/wallet/0xAf53…E044
            </a>{" "}
            to get the x402 payment terms, or{" "}
            <a className="lnk" href="/health">
              /health
            </a>{" "}
            for status.
          </p>
          <div className="row">
            <a className="lnk" href="https://leaderboard-five-neon.vercel.app">Leaderboard →</a>
            <a className="lnk" href="https://github.com/Vt01nft/pharospay-skill">Skill repo →</a>
            <a className="lnk" href="https://github.com/Vt01nft/pharospay">Full project →</a>
          </div>
        </div>
      </main>

      <div className="foot">PharosPay · paid analytics settled on Pharos Atlantic over x402</div>
    </>
  );
}
