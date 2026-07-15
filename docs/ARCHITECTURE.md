# Architecture

## Overview

```
                    ┌─────────────────────────┐
                    │        Frontend          │
                    │  React + TypeScript      │
                    │  (Vite, Freighter wallet)│
                    └────────────┬─────────────┘
                                 │ Soroban RPC (simulate / submit)
                                 ▼
                    ┌─────────────────────────┐
                    │   Prediction Market       │
                    │   Soroban contract (Rust) │
                    │   - escrow                │
                    │   - parimutuel accounting │
                    │   - resolution state machine │
                    └────────────┬─────────────┘
                                 │ token::Client (SEP-41 interface)
                                 ▼
                    ┌─────────────────────────┐
                    │   Token contract           │
                    │   (Stellar Asset Contract, │
                    │    e.g. USDC, or a custom  │
                    │    SEP-41 token)           │
                    └─────────────────────────┘
```

One contract instance = one market. This keeps each market's state small,
isolated, and easy to reason about (no risk of one market's bug or
congestion affecting another). A factory contract can be added later to
deploy new market instances programmatically — see "Scaling to many
markets" below.

## State machine

```
        initialize()
             │
             ▼
         ┌───────┐   close_ledger reached    ┌────────┐
         │ Open  ├───────────────────────────▶│ Closed │
         └───┬───┘                            └───┬────┘
             │ cancel()                            │ resolve() (oracle only,
             │                                     │  after resolve_ledger)
             ▼                                     ▼
        ┌───────────┐                         ┌──────────┐
        │ Cancelled │                         │ Resolved │
        └─────┬─────┘                         └────┬─────┘
              │                                     │
              └───────────────┬─────────────────────┘
                               ▼
                       claim() by each user
```

`Open → Closed` is a *lazy* transition: no transaction is required. Any
call that reads the market recomputes whether `close_ledger` has passed.
`cancel()` is available to the admin at any point before resolution as an
escape hatch for oracle failure or a disputed/ambiguous event.

## Payout mechanics (parimutuel)

Everyone who bet on the winning side gets their principal back, plus a
pro-rata share of the losing pool (after fee):

```
fee = losing_pool * fee_bps / 10_000
distributable = losing_pool - fee
your_winnings = distributable * your_stake / winning_pool
your_payout   = your_stake + your_winnings
```

This has three properties worth knowing:

1. **No slippage / no price impact from your own bet.** Unlike an AMM,
   betting doesn't move a "price" you then trade against — everyone in a
   pool gets the same proportional return.
2. **The implied probability show in the UI is just `total_yes /
   (total_yes + total_no)`.** It's informative, not tradeable — it's not
   an order book price, so don't treat it as one.
3. **Fees only apply to the losing pool**, so principal is never taxed.
   This avoids the common pitfall of a fee model that makes losers pay
   twice.

## Oracle design

The `oracle` address in `Market` is deliberately just an `Address` — it
can be:

- A single trusted keypair (fastest to ship, weakest trust model).
- A multisig Stellar account (`M...` address) requiring N-of-M signers.
- Another Soroban contract implementing your own dispute/voting logic,
  as long as it can produce a transaction that calls `resolve()`.

The contract does not implement dispute resolution itself. If you need
that, put it in a separate "oracle contract" and set its contract address
as the `oracle` field — this contract only needs to know *an* address
called `resolve()`, not how it decided.

## Security model / trust assumptions

| Role | Can do | Cannot do |
|---|---|---|
| Any user | Bet while `Open`, claim after `Resolved`/`Cancelled` | Withdraw before resolution, bet after close |
| `oracle` | Call `resolve()` once, only after `resolve_ledger` | Change the outcome after resolving, bet |
| `admin` | Call `cancel()` before resolution | Move funds directly, resolve the market |
| `fee_recipient` | Sweep the accumulated fee once, after resolution | Sweep before resolution or twice |

The contract never lets `admin` or `oracle` directly move user funds — all
transfers happen through `claim()`/`sweep_fee()`, which compute amounts
deterministically from on-chain state.

## Known limitations (read before mainnet)

- **Binary outcomes only.** Extending to N outcomes means changing
  `Outcome` to a `u32` index and storing `Vec<i128>` pool totals instead
  of two fixed fields — the accounting math generalizes directly.
- **No partial/early exit.** Users can't sell out of a position before
  resolution. Adding this requires either an AMM layer or a peer-to-peer
  matching layer on top of this pool.
- **Oracle centralization risk** is the single biggest real-world risk
  for any prediction market — see "Oracle design" above.
- **This contract has not been audited.** Get a professional Soroban/Rust
  audit before handling real funds. See the OpenZeppelin Stellar
  contracts suite for audited primitives you can build on top of.

## Scaling to many markets

For a platform hosting many markets, add a lightweight factory contract
that:

1. Stores a WASM hash of this contract (uploaded once).
2. Exposes `create_market(...)` which deploys a new instance via
   `env.deployer().with_current_contract(...)` and calls `initialize()`
   on it.
3. Maintains a list/map of deployed market addresses for discovery.

The frontend would then query the factory for a list of contract IDs
instead of hardcoding one `VITE_MARKET_CONTRACT_ID`.
