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

const featureCards = [
  {
    title: "Instant clarity",
    description:
      "See the live probability, pool depth, and market status in one elegant view.",
  },
  {
    title: "Trusted settlement",
    description:
      "Every outcome is routed through the market's oracle and admin controls for transparent resolution.",
  },
  {
    title: "High-conviction trading",
    description:
      "Trade with confidence using a premium experience crafted for serious participants.",
  },
];

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
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4 border border-black bg-[#dce7ff] px-4 py-4 shadow-[8px_8px_0_#000] sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center border border-black bg-white text-lg font-black">
            ◎
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-black">
              ONILE-SOROBAN
            </p>
            <p className="text-sm font-semibold text-black/80">
              Prediction markets, elevated
            </p>
          </div>
        </div>

        <nav
          className="flex items-center gap-4 text-sm font-bold text-black"
          aria-label="Main navigation"
        >
          <a
            className="border border-black bg-white px-3 py-1.5 transition hover:translate-x-[-2px] hover:translate-y-[-2px]"
            href="#markets"
          >
            Markets
          </a>
          <a
            className="border border-black bg-white px-3 py-1.5 transition hover:translate-x-[-2px] hover:translate-y-[-2px]"
            href="#how-it-works"
          >
            How it works
          </a>
        </nav>

        {publicKey ? (
          <span className="border border-black bg-white px-3 py-1.5 font-mono text-sm font-black text-black">
            {publicKey.slice(0, 4)}…{publicKey.slice(-4)}
          </span>
        ) : (
          <button
            className="border border-black bg-[#ff8a5b] px-4 py-2 font-black text-black shadow-[4px_4px_0_#000] transition hover:translate-x-[-2px] hover:translate-y-[-2px]"
            onClick={handleConnect}
          >
            Connect wallet
          </button>
        )}
      </header>

      <section className="mb-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="border border-black bg-white p-8 shadow-[8px_8px_0_#000]">
          <span className="mb-3 inline-block border border-black bg-[#dce7ff] px-3 py-1 text-[11px] font-black uppercase tracking-[0.28em] text-black">
            The finest prediction market experience
          </span>
          <h2 className="mb-3 text-3xl font-black leading-tight text-black sm:text-4xl">
            Trade conviction, settle truth, and own the outcome.
          </h2>
          <p className="max-w-2xl text-base leading-7 font-semibold text-black/80">
            ONILE-SOROBAN brings a bold, transparent, and high-performance
            market experience to the world of on-chain forecasting.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              className="border border-black bg-[#ff8a5b] px-4 py-2.5 font-black text-black shadow-[4px_4px_0_#000] transition hover:translate-x-[-2px] hover:translate-y-[-2px]"
              onClick={handleConnect}
            >
              {publicKey ? "Wallet connected" : "Launch the market"}
            </button>
            <a
              className="border border-black bg-[#dce7ff] px-4 py-2.5 text-sm font-black text-black transition hover:translate-x-[-2px] hover:translate-y-[-2px]"
              href="#markets"
            >
              Explore live market
            </a>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="border border-black bg-[#dce7ff] p-3">
              <strong className="mb-1 block text-sm font-black text-black">
                24/7
              </strong>
              <span className="text-sm font-semibold text-black/80">
                Live trading
              </span>
            </div>
            <div className="border border-black bg-[#bfe7d8] p-3">
              <strong className="mb-1 block text-sm font-black text-black">
                On-chain
              </strong>
              <span className="text-sm font-semibold text-black/80">
                Transparent settlement
              </span>
            </div>
            <div className="border border-black bg-[#f8d9c4] p-3">
              <strong className="mb-1 block text-sm font-black text-black">
                Zero fluff
              </strong>
              <span className="text-sm font-semibold text-black/80">
                Clean, serious UX
              </span>
            </div>
          </div>
        </div>

        <div className="border border-black bg-[#21324d] p-6 shadow-[8px_8px_0_#000]">
          <div className="mb-4 flex items-center justify-between">
            <span className="border border-white/40 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.28em] text-white">
              Featured market
            </span>
            <span className="border border-[#4b8f8c] bg-[#4b8f8c]/20 px-2.5 py-1 text-sm font-black text-[#4b8f8c]">
              ● Live
            </span>
          </div>

          {market ? (
            <>
              <h3 className="mb-4 text-lg font-black text-white">
                {market.question}
              </h3>
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div className="border border-[#4b8f8c] bg-[#4b8f8c]/15 p-3">
                  <span className="mb-1 block text-[11px] uppercase tracking-[0.24em] text-white/70">
                    YES
                  </span>
                  <strong className="text-base font-black text-white">
                    {formatAmount(market.totalYes)}
                  </strong>
                </div>
                <div className="border border-[#ff8a5b] bg-[#ff8a5b]/15 p-3">
                  <span className="mb-1 block text-[11px] uppercase tracking-[0.24em] text-white/70">
                    NO
                  </span>
                  <strong className="text-base font-black text-white">
                    {formatAmount(market.totalNo)}
                  </strong>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm font-semibold text-white/90">
                <div>
                  <span className="mb-1 block text-[11px] uppercase tracking-[0.24em] text-white/60">
                    Implied
                  </span>
                  <strong>
                    {impliedYesBps !== null
                      ? `${(impliedYesBps / 100).toFixed(1)}%`
                      : "--"}
                  </strong>
                </div>
                <div>
                  <span className="mb-1 block text-[11px] uppercase tracking-[0.24em] text-white/60">
                    Fee
                  </span>
                  <strong>{market.feeBps / 100}%</strong>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm leading-7 font-semibold text-white/70">
              Connect your wallet to load the live market and place your first
              bet.
            </p>
          )}
        </div>
      </section>

      <section className="mb-5 grid gap-4 md:grid-cols-3" id="how-it-works">
        {featureCards.map((card) => (
          <article
            className="border border-black bg-white p-5 shadow-[6px_6px_0_#000]"
            key={card.title}
          >
            <h3 className="mb-2 text-base font-black text-black">
              {card.title}
            </h3>
            <p className="text-sm leading-7 font-semibold text-black/80">
              {card.description}
            </p>
          </article>
        ))}
      </section>

      {message && (
        <div className="mb-5 border border-black bg-[#ff8a5b] px-4 py-3 text-sm font-black text-black">
          {message}
        </div>
      )}

      {!market && (
        <section className="mb-5 border border-black bg-white p-5 shadow-[6px_6px_0_#000]">
          <h3 className="mb-2 text-lg font-black text-black">
            Ready when you are
          </h3>
          <p className="text-sm leading-7 font-semibold text-black/80">
            Connect your wallet to load the active market and start trading with
            confidence.
          </p>
        </section>
      )}

      {market && (
        <main className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]" id="markets">
          <section className="border border-black bg-white p-5 shadow-[6px_6px_0_#000]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-black">
                  Live market
                </p>
                <h2 className="text-2xl font-black text-black">
                  {market.question}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`border border-black px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${
                    market.status.toLowerCase() === "open"
                      ? "bg-[#4b8f8c] text-black"
                      : market.status.toLowerCase() === "closed"
                        ? "bg-[#dce7ff] text-black"
                        : market.status.toLowerCase() === "resolved"
                          ? "bg-[#21324d] text-white"
                          : "bg-[#ff8a5b] text-black"
                  }`}
                >
                  {market.status}
                </span>
                {market.winner && (
                  <span className="border border-black bg-[#21324d] px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-white">
                    Winner: {market.winner}
                  </span>
                )}
              </div>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="border border-black bg-[#4b8f8c]/20 p-3">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.24em] text-black/70">
                  YES pool
                </span>
                <span className="text-base font-black text-black">
                  {formatAmount(market.totalYes)}
                </span>
              </div>
              <div className="border border-black bg-[#ff8a5b]/20 p-3">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.24em] text-black/70">
                  NO pool
                </span>
                <span className="text-base font-black text-black">
                  {formatAmount(market.totalNo)}
                </span>
              </div>
            </div>

            {impliedYesBps !== null && (
              <div className="relative mb-4 h-8 overflow-hidden border border-black bg-[#dce7ff]">
                <div
                  className="absolute inset-y-0 left-0 bg-[#4b8f8c]"
                  style={{ width: `${impliedYesBps / 100}%` }}
                />
                <span className="relative z-10 flex h-8 items-center justify-center text-sm font-black text-black">
                  {(impliedYesBps / 100).toFixed(1)}% YES
                </span>
              </div>
            )}

            <dl className="grid gap-3 text-sm font-semibold text-black/80 sm:grid-cols-3">
              <div>
                <dt className="mb-1 text-[11px] uppercase tracking-[0.24em] text-black/60">
                  Closes at ledger
                </dt>
                <dd className="font-mono font-black text-black">
                  {market.closeLedger}
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-[11px] uppercase tracking-[0.24em] text-black/60">
                  Resolvable at ledger
                </dt>
                <dd className="font-mono font-black text-black">
                  {market.resolveLedger}
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-[11px] uppercase tracking-[0.24em] text-black/60">
                  Fee
                </dt>
                <dd className="font-mono font-black text-black">
                  {market.feeBps / 100}%
                </dd>
              </div>
            </dl>
          </section>

          <div className="flex flex-col gap-4">
            <section className="border border-black bg-white p-5 shadow-[6px_6px_0_#000]">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-black">
                Your position
              </p>
              <h3 className="mb-3 text-lg font-black text-black">
                Shape your view
              </h3>
              {position && (
                <ul className="mb-4 space-y-2 font-mono text-sm font-black text-black">
                  <li>YES stake: {formatAmount(position.yesStake)}</li>
                  <li>NO stake: {formatAmount(position.noStake)}</li>
                </ul>
              )}

              {market.status === "Open" && (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <button
                      className={`border border-black px-3 py-2 text-sm font-black transition ${
                        outcome === "Yes"
                          ? "bg-[#4b8f8c] text-black"
                          : "bg-white text-black"
                      }`}
                      onClick={() => setOutcome("Yes")}
                    >
                      YES
                    </button>
                    <button
                      className={`border border-black px-3 py-2 text-sm font-black transition ${
                        outcome === "No"
                          ? "bg-[#ff8a5b] text-black"
                          : "bg-white text-black"
                      }`}
                      onClick={() => setOutcome("No")}
                    >
                      NO
                    </button>
                  </div>
                  <input
                    className="w-full border border-black bg-[#dce7ff] px-3 py-2.5 text-black outline-none"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <button
                    className="border border-black bg-[#ff8a5b] px-4 py-2.5 font-black text-black shadow-[4px_4px_0_#000] transition hover:translate-x-[-2px] hover:translate-y-[-2px]"
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
                  className="border border-black bg-[#ff8a5b] px-4 py-2.5 font-black text-black shadow-[4px_4px_0_#000] transition hover:translate-x-[-2px] hover:translate-y-[-2px]"
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
              <section className="border border-black bg-white p-5 shadow-[6px_6px_0_#000]">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-black">
                  Admin / Oracle
                </p>
                <h3 className="mb-3 text-lg font-black text-black">
                  Resolution controls
                </h3>
                {isOracle && market.status === "Closed" && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      className="border border-black bg-[#dce7ff] px-3 py-2 text-sm font-black text-black"
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
                      className="border border-black bg-[#bfe7d8] px-3 py-2 text-sm font-black text-black"
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
                      className="border border-black bg-[#ff8a5b] px-4 py-2.5 font-black text-black shadow-[4px_4px_0_#000] transition hover:translate-x-[-2px] hover:translate-y-[-2px]"
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
          </div>
        </main>
      )}
    </div>
  );
}
