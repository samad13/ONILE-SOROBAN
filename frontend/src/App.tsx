import { useCallback, useEffect, useState } from "react";
import { connectWallet } from "./lib/wallet";
import {
  cancelMarket,
  claim,
  getImpliedYesBps,
  getMarket,
  getPosition,
  placeBet,
  resolveMarket,
} from "./lib/contract";
import type { Market, Outcome, Position } from "./types";

const AMOUNT_SCALE = 10_000_000n; // 7 decimal places, standard for Stellar assets

function formatAmount(stroops: bigint): string {
  const whole = stroops / AMOUNT_SCALE;
  const frac = stroops % AMOUNT_SCALE;
  return `${whole}.${frac.toString().padStart(7, "0").slice(0, 2)}`;
}

function toStroops(input: string): bigint {
  const [whole, frac = ""] = input.split(".");
  const paddedFrac = (frac + "0000000").slice(0, 7);
  return BigInt(whole || "0") * AMOUNT_SCALE + BigInt(paddedFrac || "0");
}

export default function App() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [market, setMarket] = useState<Market | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [impliedYesBps, setImpliedYesBps] = useState<number | null>(null);
  const [amount, setAmount] = useState("10");
  const [outcome, setOutcome] = useState<Outcome>("Yes");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async (key: string) => {
    const [m, p, bps] = await Promise.all([
      getMarket(key),
      getPosition(key, key),
      getImpliedYesBps(key),
    ]);
    setMarket(m);
    setPosition(p);
    setImpliedYesBps(bps);
  }, []);

  useEffect(() => {
    if (publicKey) {
      refresh(publicKey).catch((e) => setMessage(String(e)));
    }
  }, [publicKey, refresh]);

  async function handleConnect() {
    try {
      const wallet = await connectWallet();
      setPublicKey(wallet.publicKey);
    } catch (e) {
      setMessage(String(e));
    }
  }

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      if (publicKey) await refresh(publicKey);
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }

  const isAdmin = publicKey && market && publicKey === market.admin;
  const isOracle = publicKey && market && publicKey === market.oracle;

  return (
    <div className="page">
      <header className="topbar">
        <h1>ONILE-SOROBAN Prediction Market</h1>
        {publicKey ? (
          <span className="pill">
            {publicKey.slice(0, 4)}…{publicKey.slice(-4)}
          </span>
        ) : (
          <button onClick={handleConnect}>Connect Wallet</button>
        )}
      </header>

      {message && <div className="banner error">{message}</div>}

      {!market && (
        <p className="muted">Connect your wallet to load the market.</p>
      )}

      {market && (
        <main className="grid">
          <section className="card">
            <h2>{market.question}</h2>
            <div className="status-row">
              <span className={`badge badge-${market.status.toLowerCase()}`}>
                {market.status}
              </span>
              {market.winner && (
                <span className="badge badge-winner">
                  Winner: {market.winner}
                </span>
              )}
            </div>

            <div className="pools">
              <div className="pool pool-yes">
                <span className="label">YES pool</span>
                <span className="value">{formatAmount(market.totalYes)}</span>
              </div>
              <div className="pool pool-no">
                <span className="label">NO pool</span>
                <span className="value">{formatAmount(market.totalNo)}</span>
              </div>
            </div>

            {impliedYesBps !== null && (
              <div className="prob-bar">
                <div
                  className="prob-fill"
                  style={{ width: `${impliedYesBps / 100}%` }}
                />
                <span className="prob-label">
                  {(impliedYesBps / 100).toFixed(1)}% YES
                </span>
              </div>
            )}

            <dl className="meta">
              <div>
                <dt>Closes at ledger</dt>
                <dd>{market.closeLedger}</dd>
              </div>
              <div>
                <dt>Resolvable at ledger</dt>
                <dd>{market.resolveLedger}</dd>
              </div>
              <div>
                <dt>Fee</dt>
                <dd>{market.feeBps / 100}%</dd>
              </div>
            </dl>
          </section>

          <section className="card">
            <h3>Your position</h3>
            {position && (
              <ul className="position-list">
                <li>YES stake: {formatAmount(position.yesStake)}</li>
                <li>NO stake: {formatAmount(position.noStake)}</li>
              </ul>
            )}

            {market.status === "Open" && (
              <div className="bet-form">
                <div className="outcome-toggle">
                  <button
                    className={outcome === "Yes" ? "active" : ""}
                    onClick={() => setOutcome("Yes")}
                  >
                    YES
                  </button>
                  <button
                    className={outcome === "No" ? "active" : ""}
                    onClick={() => setOutcome("No")}
                  >
                    NO
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <button
                  disabled={busy || !publicKey}
                  onClick={() =>
                    withBusy(async () => {
                      if (!publicKey) return;
                      await placeBet(publicKey, outcome, toStroops(amount));
                    })
                  }
                >
                  Place bet
                </button>
              </div>
            )}

            {(market.status === "Resolved" ||
              market.status === "Cancelled") && (
              <button
                disabled={busy || !publicKey}
                onClick={() =>
                  withBusy(async () => {
                    if (!publicKey) return;
                    await claim(publicKey);
                  })
                }
              >
                Claim
              </button>
            )}
          </section>

          {(isAdmin || isOracle) && (
            <section className="card admin-card">
              <h3>Admin / Oracle controls</h3>
              {isOracle && market.status === "Closed" && (
                <div className="admin-row">
                  <button
                    disabled={busy}
                    onClick={() =>
                      withBusy(async () => {
                        if (!publicKey) return;
                        await resolveMarket(publicKey, "Yes");
                      })
                    }
                  >
                    Resolve: YES
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      withBusy(async () => {
                        if (!publicKey) return;
                        await resolveMarket(publicKey, "No");
                      })
                    }
                  >
                    Resolve: NO
                  </button>
                </div>
              )}
              {isAdmin &&
                market.status !== "Resolved" &&
                market.status !== "Cancelled" && (
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() =>
                      withBusy(async () => {
                        if (!publicKey) return;
                        await cancelMarket(publicKey);
                      })
                    }
                  >
                    Cancel market
                  </button>
                )}
            </section>
          )}
        </main>
      )}
    </div>
  );
}
