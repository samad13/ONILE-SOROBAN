# Contributing

Thanks for considering contributing. This project has two halves that
mostly develop independently:

- `contracts/prediction-market` — the Soroban smart contract (Rust)
- `frontend` — the TypeScript/React app

## Getting set up

Follow `docs/DEPLOYMENT.md` to get a local Testnet deployment running end
to end before making changes — it's the fastest way to know your
environment works.

Minimum tools:
- Rust + `wasm32-unknown-unknown` target
- `stellar-cli`
- Node.js 18+

## Workflow

1. Check open issues, especially ones labeled `good first issue` if
   you're new to Soroban or the codebase.
2. Comment on the issue to claim it, so two people don't duplicate work.
3. Branch off `main`: `git checkout -b fix/short-description`.
4. Make your change. See "Standards" below.
5. Open a PR against `main`, referencing the issue (`Closes #12`).

## Standards

### Contract changes
- Every new public contract method needs a corresponding test in
  `src/test.rs`.
- Run `cargo test` and `stellar contract build` before opening a PR.
- Any change to escrow, payout math, or state transitions needs a
  written explanation in the PR description of what invariant you
  checked (e.g. "principal is always returned in full" — see
  `docs/ARCHITECTURE.md`).
- Don't silently change the `Error` enum's existing variant numbers —
  add new ones at the end. Changing existing values breaks anyone who
  already deployed the old contract.

### Frontend changes
- Keep `npm run lint` (`tsc --noEmit`) clean.
- New contract methods added to `lib.rs` should get a matching typed
  function in `src/lib/contract.ts`, not ad-hoc calls in components.
- No `any` types for data coming back from the contract — extend
  `src/types.ts` instead.

### Docs
- If you change contract behavior, update `docs/ARCHITECTURE.md`.
- If you change the deploy process or CLI flags, update
  `docs/DEPLOYMENT.md`.

## Reporting bugs / proposing features

Use the issue templates under `.github/ISSUE_TEMPLATE/`. For anything
touching fund-handling logic (escrow, payout, fee sweep), please include
a specific reproduction or attack scenario, not just a description.

## Security issues

Do not open a public issue for a suspected vulnerability that could
affect funds on a live deployment. Instead, contact the maintainers
privately (add your preferred contact method here before publishing this
repo).
