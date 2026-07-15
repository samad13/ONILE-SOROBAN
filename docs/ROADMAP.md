# Roadmap

This breaks the project into phases you can turn directly into GitHub
milestones. Each phase lists the issues that belong to it — kept
deliberately small and granular (115+ issues total) so a contributor can
pick something up in an afternoon rather than needing to own a whole
feature. Full issue bodies (title, description, acceptance criteria,
labels) live in `scripts/create-github-issues.sh`, which will file all of
them automatically once the repo exists on GitHub — see that file to read
them without running anything, or run it to create them for real.

Phases are ordered by dependency, not strict calendar time — Phase 2
(frontend) can run in parallel with Phase 1 (contract hardening) once the
initial scaffold is in place, since both build on what's already shipped.

---

## Phase 0 — Scaffold (done)
The current state of this repo: a working binary parimutuel contract, a
functional frontend, and baseline docs. File issues for anything you find
broken while setting it up.

## Phase 1 — Contract hardening (~28 issues)
Goal: the contract is something you'd trust with real (if small) amounts
on Testnet, with test coverage for every state transition, edge case, and
authorization path, plus CI enforcing it stays that way.

Covers: negative-path test coverage for every method and error variant,
payout-rounding/solvency fuzz tests, configurable min/max bet limits,
gas/resource cost documentation, a pre-audit security checklist, storage
TTL review, an authorization test matrix (every method × every wrong
caller), and CI workflows for `cargo test`, `stellar contract build`,
clippy, and rustfmt.

## Phase 2 — Frontend completion (~27 issues)
Goal: someone with a Freighter wallet and zero blockchain background can
use this without reading the code, and the codebase has the same testing
and linting discipline as the contract.

Covers: wallet connection edge cases (not installed, network mismatch,
reconnect/disconnect flow), loading and transaction-status UI, mobile
responsiveness, accessibility, bet amount validation, a countdown to
close/resolve ledgers, an events-based activity feed, unit tests for the
formatting/parsing helpers, an e2e test of the full connect→bet→claim
flow, and ESLint/Prettier/Storybook setup.

## Phase 3 — Multi-market support (~15 issues)
Goal: stop hardcoding one contract ID; support many concurrent markets
discoverable from the frontend.

Covers: a market factory contract with tests, an off-chain indexer for
factory events, a market browse/search/filter/sort page, per-market URL
routing, and an admin-facing create-market form.

## Phase 4 — Oracle decentralization (~10 issues)
Goal: remove single-key resolution risk for anything beyond a toy
deployment.

Covers: a design doc comparing multisig vs. voting-contract oracles,
implementing whichever is chosen, a dispute window before `claim()`
opens, and documentation of oracle key-management best practices.

## Phase 5 — Advanced market types (~10 issues)
Goal: go beyond binary/parimutuel once the base is solid.

Covers: generalizing `Outcome` to N outcomes, an LMSR AMM prototype for
continuous pricing, and a partial-exit mechanism design + prototype.

## Phase 6 — Mainnet readiness (~10 issues)
Goal: ready for real funds.

Covers: commissioning and tracking a security audit, stuck-market
monitoring/alerting, a legal/regulatory review checklist, a production
deployment runbook, and admin/oracle key-management guidance.

## Phase 7 — Community & developer experience (~15 issues)
Goal: make it easy for new contributors to find their footing.

Covers: LICENSE, CODE_OF_CONDUCT, PR template, a real architecture
diagram image, a FAQ and Stellar/Soroban glossary for newcomers, a
one-command local setup script, Docker Compose for a local Soroban
sandbox, CHANGELOG process, and an audit pass to make sure everything
labeled `good first issue` actually is.

---

## Suggested labels

| Label | Meaning |
|---|---|
| `contract` | Rust/Soroban changes |
| `frontend` | TypeScript/React changes |
| `docs` | Documentation only |
| `security` | Anything touching fund safety |
| `devex` | Tooling, CI, contributor experience |
| `good first issue` | Small, well-scoped, good onboarding task |
| `phase-1` … `phase-7` | Maps to the phases above |

## Suggested milestones

Create one GitHub milestone per phase (`Phase 1: Contract hardening`,
etc.) and assign issues to them so contributors can see progress at
`github.com/<org>/<repo>/milestones`.
