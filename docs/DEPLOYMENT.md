# Deployment Guide

This walks through deploying the contract to **Testnet** and wiring the
frontend up to it. Swap `testnet` for `mainnet`/`pubnet` flags once you've
tested thoroughly and had the contract audited.

## 1. Install prerequisites

```bash
# Rust + the wasm target
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Stellar CLI (includes Soroban tooling)
cargo install --locked stellar-cli --features opt

# Node.js 18+ for the frontend
```

Verify:

```bash
stellar --version
cargo --version
node --version
```

## 2. Configure a Testnet identity

```bash
stellar keys generate admin --network testnet --fund
stellar keys generate oracle --network testnet --fund
stellar keys address admin
stellar keys address oracle
```

`--fund` requests Testnet XLM from Friendbot automatically.

## 3. Build the contract

```bash
cd contracts/prediction-market
stellar contract build
```

This produces
`target/wasm32-unknown-unknown/release/prediction_market.wasm`.

Run the unit tests first:

```bash
cargo test
```

## 4. Pick a token to bet with

For Testnet, the simplest option is to issue your own test asset via the
Stellar Asset Contract (SAC), or use an existing Testnet USDC issuer.

To wrap a classic Stellar asset as a Soroban token:

```bash
stellar contract asset deploy \
  --asset USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN \
  --network testnet \
  --source admin
```

This prints the token's Soroban contract ID — save it as `TOKEN_ID`.

## 5. Deploy the market contract

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/prediction_market.wasm \
  --network testnet \
  --source admin
```

Save the printed contract ID as `MARKET_ID`.

## 6. Initialize the market

Pick ledger numbers for `close_ledger` and `resolve_ledger`. Check the
current ledger with:

```bash
stellar network query latest-ledger --network testnet
```

Then, assuming ~5 seconds per ledger, add a buffer for your betting
window (e.g. +5000 ledgers ≈ ~7 hours) and a further buffer before
resolution:

```bash
stellar contract invoke \
  --id $MARKET_ID \
  --network testnet \
  --source admin \
  -- initialize \
  --admin $(stellar keys address admin) \
  --oracle $(stellar keys address oracle) \
  --token $TOKEN_ID \
  --question "Will it rain in NYC on 2026-08-01?" \
  --close_ledger 1250000 \
  --resolve_ledger 1252000 \
  --fee_bps 300 \
  --fee_recipient $(stellar keys address admin)
```

## 7. Fund a test account and place a bet (CLI sanity check)

```bash
stellar keys generate alice --network testnet --fund

# Mint test tokens to alice if you deployed your own SAC as admin/issuer:
stellar contract invoke --id $TOKEN_ID --network testnet --source admin \
  -- mint --to $(stellar keys address alice) --amount 1000000000

# Place a bet: 100.0000000 units on YES
stellar contract invoke --id $MARKET_ID --network testnet --source alice \
  -- bet --user $(stellar keys address alice) --outcome '{"Yes":[]}' --amount 1000000000
```

> Note: enum arguments passed via the CLI use a JSON-ish shorthand for
> unit variants, e.g. `{"Yes":[]}`. Check `stellar contract invoke --help`
> for the exact syntax for your CLI version if this differs.

## 8. Resolve and claim (after resolve_ledger)

```bash
stellar contract invoke --id $MARKET_ID --network testnet --source oracle \
  -- resolve --caller $(stellar keys address oracle) --winner '{"Yes":[]}'

stellar contract invoke --id $MARKET_ID --network testnet --source alice \
  -- claim --user $(stellar keys address alice)
```

## 9. Configure and run the frontend

```bash
cd ../../frontend
cp .env.example .env
```

Edit `.env`:

```
VITE_STELLAR_NETWORK=TESTNET
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_MARKET_CONTRACT_ID=<MARKET_ID from step 5>
```

Install and run:

```bash
npm install
npm run dev
```

Open the printed local URL, install the [Freighter wallet
extension](https://www.freighter.app/) if you haven't, switch it to
Testnet, import the `alice` account (or any funded Testnet account), and
connect.

## Deploying to Mainnet

1. Repeat steps 3–6 with `--network mainnet` and a funded mainnet source
   account. Use a real asset's SAC (USDC's mainnet contract ID is
   published by Circle/Stellar) rather than a test-minted token.
2. Use a genuinely decentralized or at least multi-party `oracle` address
   — a single hot key resolving real-money markets is a significant
   centralization and key-custody risk.
3. Get an independent security audit of the contract before accepting
   real funds. See `docs/ARCHITECTURE.md` → "Known limitations."
4. Update `frontend/.env` with `VITE_STELLAR_NETWORK=PUBLIC`,
   `VITE_SOROBAN_RPC_URL=https://mainnet.sorobanrpc.com` (or your RPC
   provider of choice), and the mainnet `MARKET_ID`.
5. Build and deploy the frontend as a static site (`npm run build`
   outputs to `frontend/dist/`) to any static host (Vercel, Netlify,
   Cloudflare Pages, S3+CloudFront, etc).
