import { createPublicClient, http, type Chain } from "viem";
import { chainById, ledgerAbi, getAddresses, type Hex } from "@pharospay/shared";
import { fmtUsd, short } from "../../../lib/leaderboard";

export const dynamic = "force-dynamic";

async function getStats(address: Hex) {
  try {
    const chainId = Number(process.env.PHAROS_CHAIN_ID ?? "688688");
    const rpcUrl = process.env.PHAROS_RPC_URL ?? "https://testnet.dplabs-internal.com";
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
    <main className="wrap">
      <div className="brand">
        <a className="logo" href="/">
          P
        </a>
        <div className="title">Agent Profile</div>
      </div>
      <p className="subtitle">
        <span className="addr">{address}</span>
      </p>

      <div className="stats">
        <div className="stat">
          <div className="n">{s ? s.repScore : 0}</div>
          <div className="l">reputation</div>
        </div>
        <div className="stat">
          <div className="n">
            <span className="flame">🔥</span> {s ? s.streak : 0}
          </div>
          <div className="l">day streak</div>
        </div>
        <div className="stat">
          <div className="n">{s ? s.txCount : 0}</div>
          <div className="l">payments</div>
        </div>
      </div>

      <div className="boards">
        <div className="board">
          <h2>
            Paid <span className="tag">spend</span>
          </h2>
          <div className="row">
            <div className="rank">∑</div>
            <div className="addr">total paid</div>
            <div className="val">
              {s ? fmtUsd(s.totalPaid) : "0"}
              <span className="u">pUSD</span>
            </div>
          </div>
        </div>
        <div className="board">
          <h2>
            Earned <span className="tag">earn</span>
          </h2>
          <div className="row">
            <div className="rank">∑</div>
            <div className="addr">total earned</div>
            <div className="val">
              {s ? fmtUsd(s.totalEarned) : "0"}
              <span className="u">pUSD</span>
            </div>
          </div>
        </div>
      </div>

      <div className="footer">
        <p>
          <span className="pill">share</span>{" "}
          <a href={`/card/agent/${address}`}>proof card image</a> ·{" "}
          <a href={`/?ref=${address}`}>referral link</a> ·{" "}
          <a href={explorer} target="_blank" rel="noreferrer">
            view on PharosScan
          </a>
        </p>
        <p>Referrals grant both sides bonus pUSD faucet credit via the token&apos;s claimWithReferrer.</p>
      </div>
    </main>
  );
}
