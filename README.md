# Prediction Market on Stellar (Soroban)

A binary-outcome (YES/NO) prediction market built as a Soroban smart
contract on Stellar, with a TypeScript/React frontend.

Users deposit a token onto YES or NO before a betting deadline. After an
oracle submits the real-world outcome, winners split the losing pool
pro-rata to their stake (a "parimutuel" model — like a horse-racing pool,
not an order book or AMM). See `docs/ARCHITECTURE.md` for the full design
rationale and `docs/DEPLOYMENT.md` for a step-by-step deploy guide.

```
prediction-market/
├── contracts/
│   └── prediction-market/     # Soroban smart contract (Rust)
│       ├── src/lib.rs
│       └── src/test.rs
├── frontend/                  # TypeScript + React app
│   └── src/
│       ├── lib/contract.ts    # Soroban RPC client
│       ├── lib/wallet.ts      # Freighter wallet integration
│       └── App.tsx
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   └── ROADMAP.md             # Development phases + planned issues
├── scripts/
│   └── create-github-issues.sh   # Bulk-files the roadmap's issues via `gh`
├── .github/ISSUE_TEMPLATE/    # Bug report / feature request templates
└── CONTRIBUTING.md
```

## Contributing

See `CONTRIBUTING.md` for workflow and code standards, and
`docs/ROADMAP.md` for the phased plan and open issues. If you're setting
this up as your own repo, run `./scripts/create-github-issues.sh` once
(after `gh auth login`) to file the full backlog automatically.

## How it works, in short

1. **Admin** deploys and initializes a market: a question, a betting
   token, a close deadline, a resolve deadline, and an oracle address.
2. **Users** call `bet(user, outcome, amount)` before the close deadline.
   Funds move into contract escrow.
3. After the close deadline (and the resolve deadline, which gives a
   buffer for the real event to actually happen), the **oracle** calls
   `resolve(caller, winner)` exactly once.
4. **Users** call `claim(user)` to receive principal + pro-rata winnings
   (winners) or nothing (losers). If the admin calls `cancel()` instead
   of the oracle resolving, everyone can `claim()` a full refund.

```
your_winnings = (losing_pool - fee) * your_stake / winning_pool
your_payout   = your_stake + your_winnings
```

Full state machine and payout math: `docs/ARCHITECTURE.md`.

## Quick start

### Prerequisites
- Rust + `wasm32-unknown-unknown` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli/install-cli) (`stellar-cli`)
- Node.js 18+
- [Freighter wallet](https://www.freighter.app/) browser extension (for using the frontend)

### 1. Build & test the contract

```bash
cd contracts/prediction-market
stellar contract build
cargo test
```

### 2. Deploy to Testnet

Full walkthrough in `docs/DEPLOYMENT.md`. Short version:

```bash
stellar keys generate admin --network testnet --fund
stellar keys generate oracle --network testnet --fund

stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/prediction_market.wasm \
  --network testnet --source admin
# -> save the printed contract ID as MARKET_ID

stellar contract invoke --id $MARKET_ID --network testnet --source admin -- \
  initialize \
  --admin $(stellar keys address admin) \
  --oracle $(stellar keys address oracle) \
  --token <TOKEN_CONTRACT_ID> \
  --question "Will it rain in NYC on 2026-08-01?" \
  --close_ledger <ledger_number> \
  --resolve_ledger <later_ledger_number> \
  --fee_bps 300 \
  --fee_recipient $(stellar keys address admin)
```

### 3. Run the frontend

```bash
cd frontend
cp .env.example .env   # then set VITE_MARKET_CONTRACT_ID to $MARKET_ID
npm install
npm run dev
```

Open the local URL, connect Freighter (set to Testnet), and place a bet.

## Contract API reference

| Method | Caller | When | Effect |
|---|---|---|---|
| `initialize(admin, oracle, token, question, close_ledger, resolve_ledger, fee_bps, fee_recipient)` | admin | once | Creates the market |
| `bet(user, outcome, amount)` | any user | while `Open` | Escrows `amount` of `token` on `Yes` or `No` |
| `resolve(caller, winner)` | oracle | after `resolve_ledger` | Locks in the winning outcome |
| `cancel(caller)` | admin | before resolved | Marks the market cancelled (refundable) |
| `claim(user)` | any user | after resolved/cancelled | Pays out winnings or refund; one-time |
| `sweep_fee(caller)` | fee_recipient | after resolved | Withdraws the protocol fee; one-time |
| `get_market()` | anyone (view) | any time | Returns the full `Market` struct |
| `get_position(user)` | anyone (view) | any time | Returns `(yes_stake, no_stake)` |
| `implied_yes_bps()` | anyone (view) | any time | Naive pool-ratio probability estimate, 0–10000 |

Error codes are defined in the `Error` enum in `contracts/prediction-market/src/lib.rs`
(e.g. `MarketNotOpen`, `TooEarlyToResolve`, `AlreadyClaimed`).

## Frontend structure

- `src/lib/contract.ts` — builds, simulates, signs, and submits Soroban
  transactions using `@stellar/stellar-sdk`. One exported function per
  contract method (`getMarket`, `placeBet`, `claim`, `resolveMarket`,
  `cancelMarket`, ...).
- `src/lib/wallet.ts` — thin wrapper around `@stellar/freighter-api` for
  connecting a wallet and signing transactions.
- `src/types.ts` — TypeScript types mirroring the Rust contract's structs
  and enums.
- `src/App.tsx` — the UI: market status, pool sizes, an implied-probability
  bar, a bet form, a claim button, and an admin/oracle panel that only
  appears for the connected admin/oracle address.

The frontend talks to Soroban RPC directly from the browser — there is no
backend server. All state lives on-chain.

## Extending this project

- **Multi-outcome markets**: generalize `Outcome` to an index into a
  `Vec<i128>` of pool totals (see `docs/ARCHITECTURE.md`).
- **Continuous/AMM pricing**: layer an LMSR or constant-product market
  maker contract that itself holds a position in this pool, giving you
  a real-time tradeable price instead of a settle-at-the-end pool.
- **Market factory**: deploy new market instances programmatically
  instead of one contract per market by hand (`docs/ARCHITECTURE.md`).
- **Decentralized oracle**: replace the single `oracle` address with a
  voting/staking contract address.

## Security notes

- This contract has **not been audited**. Treat it as a reference
  implementation / starting point, not production-ready code.
- The biggest real-world risk in any prediction market is oracle
  trust — read `docs/ARCHITECTURE.md` → "Oracle design" before launching
  anything with real money.
- Prediction markets on real-world events (elections, sports, etc.) can
  trigger securities, gambling, or CFTC/derivatives regulation depending
  on your jurisdiction and structure. Get legal advice before launch;
  this repository is a technical starting point, not legal guidance.

## License

MIT — see the header comments in `contracts/prediction-market/src/lib.rs`;
add a `LICENSE` file with your organization's preferred license before
publishing.
