#!/usr/bin/env bash
# Files every issue from docs/ROADMAP.md into the current repo's GitHub
# issue tracker using the GitHub CLI.
#
# Prerequisites:
#   - `gh` installed and authenticated (`gh auth login`)
#   - run from inside a clone whose `origin` is the target GitHub repo
#
# Usage:
#   ./scripts/create-github-issues.sh
#
# Files 117 issues across Phases 1-7. Safe to re-run only if you
# want duplicates — gh does not dedupe automatically.

set -euo pipefail

if ! command -v gh &> /dev/null; then
  echo "GitHub CLI (gh) not found. Install it: https://cli.github.com/"
  exit 1
fi

create() {
  local title="$1"
  local labels="$2"
  local body="$3"
  echo "Creating: $title"
  gh issue create --title "$title" --label "$labels" --body "$body"
}

# ---------------------------------------------------------------------
# Labels used below assume these already exist in the repo. Create any
# missing ones first, e.g.:
#   gh label create "phase-1" --color "BFD4F2"
#   gh label create "phase-2" --color "BFD4F2"
#   gh label create "phase-3" --color "BFD4F2"
#   gh label create "phase-4" --color "BFD4F2"
#   gh label create "phase-5" --color "BFD4F2"
#   gh label create "phase-6" --color "BFD4F2"
#   gh label create "phase-7" --color "BFD4F2"
#   gh label create "contract" --color "5319E7"
#   gh label create "frontend" --color "0E8A16"
#   gh label create "docs" --color "0075CA"
#   gh label create "devex" --color "FBCA04"
#   gh label create "security" --color "D93F0B"
#   gh label create "good first issue" --color "7057FF"
# ---------------------------------------------------------------------

# --- Phase 1: Contract hardening ---

create "Test: double-claim returns AlreadyClaimed" \
  "contract,phase-1,good first issue" \
  "Add a test where the same user calls claim() twice after resolution and assert the second call returns Error::AlreadyClaimed."

create "Test: zero-stake claim returns NothingToClaim" \
  "contract,phase-1,good first issue" \
  "Add a test where a user with zero stake on both sides calls claim() after resolution and assert Error::NothingToClaim."

create "Test: claim before resolution returns MarketNotResolved" \
  "contract,phase-1,good first issue" \
  "Add a test calling claim() while the market is still Open or Closed (not resolved/cancelled) and assert Error::MarketNotResolved."

create "Test: bet() at ledger == close_ledger fails" \
  "contract,phase-1" \
  "Advance the test ledger to exactly close_ledger and assert bet() returns Error::MarketNotOpen."

create "Test: bet() at ledger == close_ledger - 1 succeeds" \
  "contract,phase-1,good first issue" \
  "Advance the test ledger to close_ledger - 1 and assert bet() still succeeds. Documents the exact boundary."

create "Test: resolve() before resolve_ledger fails" \
  "contract,phase-1" \
  "Call resolve() at a ledger before resolve_ledger and assert Error::TooEarlyToResolve."

create "Test: resolve() by non-oracle fails" \
  "contract,phase-1,good first issue" \
  "Call resolve() from an address that isn't the configured oracle and assert Error::NotOracle."

create "Test: cancel() by non-admin fails" \
  "contract,phase-1,good first issue" \
  "Call cancel() from an address that isn't the configured admin and assert Error::NotAdmin."

create "Test: initialize() with fee_bps > 1000 fails" \
  "contract,phase-1,good first issue" \
  "Call initialize() with fee_bps = 1001 and assert Error::FeeTooHigh."

create "Test: initialize() with close_ledger in the past fails" \
  "contract,phase-1,good first issue" \
  "Call initialize() with a close_ledger below the current ledger sequence and assert Error::InvalidLedgers."

create "Test: initialize() with resolve_ledger before close_ledger fails" \
  "contract,phase-1" \
  "Call initialize() with resolve_ledger < close_ledger and assert Error::InvalidLedgers."

create "Test: initialize() called twice fails" \
  "contract,phase-1,good first issue" \
  "Call initialize() a second time on an already-initialized contract instance and assert Error::AlreadyInitialized."

create "Test: bet() with zero amount fails" \
  "contract,phase-1,good first issue" \
  "Call bet() with amount = 0 and assert Error::ZeroAmount."

create "Test: bet() with negative amount fails" \
  "contract,phase-1,good first issue" \
  "Call bet() with a negative amount and assert Error::ZeroAmount (or a new dedicated error if you decide to split it out)."

create "Fuzz test: payout rounding with a single bettor on the winning side" \
  "contract,phase-1,security" \
  "Property-test claim() when exactly one address holds the entire winning pool; assert payout == stake + full losing pool minus fee, with no leftover dust unaccounted for."

create "Fuzz test: payout rounding with extreme pool imbalance" \
  "contract,phase-1,security" \
  "Property-test claim() with pool ratios like 1 vs 1_000_000_000 on either side; assert no overflow and no payout exceeding the available pool."

create "Fuzz test: payout rounding with many small bettors" \
  "contract,phase-1,security" \
  "Property-test claim() with 50+ small bettors splitting a small losing pool; assert the sum of all payouts never exceeds total_yes + total_no."

create "Add a solvency invariant test across full market lifecycles" \
  "contract,phase-1,security" \
  "Write a test harness that runs a random sequence of bets, resolves, and claims, then asserts the contract's token balance never goes negative and covers every successful claim."

create "Add configurable min_bet field and enforcement" \
  "contract,phase-1" \
  "Add an optional min_bet field to Market set at initialize() time (0 = no minimum); bet() should reject amounts below it with a new Error variant."

create "Add configurable max_bet field and enforcement" \
  "contract,phase-1" \
  "Add an optional max_bet field to Market set at initialize() time (0 = no maximum); bet() should reject amounts above it with a new Error variant."

create "Add tests for min_bet / max_bet boundaries" \
  "contract,phase-1,good first issue" \
  "Cover exactly-at-boundary and one-above/one-below cases for both new limits once the fields above exist."

create "Document gas/resource cost per contract method" \
  "contract,phase-1,docs,good first issue" \
  "Run each method via \`stellar contract invoke\` on Testnet, record the simulated CPU/memory/storage footprint, and add a cost table to docs/ARCHITECTURE.md."

create "Write a pre-audit security checklist" \
  "contract,phase-1,security" \
  "New docs/SECURITY_CHECKLIST.md covering reentrancy assumptions, overflow checks, authorization on every mutating call, storage TTL handling, and payout invariants, filled in with pass/fail against the current contract."

create "Audit storage TTL / extend_ttl calls for correctness" \
  "contract,phase-1,security" \
  "Review every extend_ttl call in lib.rs for reasonable thresholds and confirm no storage entry can expire mid-lifecycle unexpectedly; document the chosen TTL values and rationale."

create "Add explicit overflow edge-case tests" \
  "contract,phase-1" \
  "With overflow-checks = true in the release profile, add tests attempting to overflow total_yes/total_no accumulation and confirm the transaction panics/aborts safely rather than wrapping."

create "Add an authorization test matrix" \
  "contract,phase-1,security" \
  "Systematically test every state-mutating method against every non-authorized caller (wrong user, wrong oracle, wrong admin, wrong fee_recipient) to confirm require_auth and role checks can't be bypassed."

create "Add CI workflow: cargo test on every PR" \
  "contract,phase-1,devex,good first issue" \
  "Add .github/workflows/contract-test.yml running \`cargo test\` inside contracts/prediction-market on every push and PR."

create "Add CI workflow: stellar contract build on every PR" \
  "contract,phase-1,devex,good first issue" \
  "Add a CI step that runs \`stellar contract build\` to catch WASM build breakage separately from unit test breakage."

create "Add clippy to CI and fix existing warnings" \
  "contract,phase-1,devex,good first issue" \
  "Add \`cargo clippy -- -D warnings\` as a CI step; fix whatever it currently flags."

create "Add rustfmt check to CI" \
  "contract,phase-1,devex,good first issue" \
  "Add a rustfmt.toml and a CI step running \`cargo fmt -- --check\`."

# --- Phase 2: Frontend completion ---

create "Handle Freighter-not-installed with an install prompt" \
  "frontend,phase-2,good first issue" \
  "connectWallet() currently throws a generic error if Freighter isn't installed. Detect that specific case and show a UI prompt linking to https://www.freighter.app/ instead of a raw error banner."

create "Add loading/skeleton state while market data loads" \
  "frontend,phase-2,good first issue" \
  "Show a skeleton/placeholder card while getMarket/getPosition/getImpliedYesBps are in flight instead of a blank page, with no layout shift once real data arrives."

create "Add transaction status feedback with explorer link" \
  "frontend,phase-2" \
  "After placeBet/claim/resolveMarket/cancelMarket submit, surface the transaction hash, link to the appropriate Stellar explorer URL for the configured network, and distinguish pending/confirmed/failed states."

create "Mobile responsive layout pass" \
  "frontend,phase-2,good first issue" \
  "Make .grid, .pools, .meta, and .bet-form in src/styles.css degrade to a single column below ~480px; verify on an actual mobile viewport."

create "Validate bet amount against wallet balance before submitting" \
  "frontend,phase-2" \
  "Fetch the user's token balance for the market's token and disable the bet button with an inline message if the entered amount exceeds it or is zero/negative."

create "Warn on Freighter network mismatch" \
  "frontend,phase-2,good first issue" \
  "Read the connected wallet's active network and show a clear warning banner with switch instructions if it doesn't match config.network."

create "Add a toast/notification system instead of a single error banner" \
  "frontend,phase-2" \
  "Replace the single \`message\` banner in App.tsx with a stacked toast system so multiple errors/confirmations don't overwrite each other."

create "Add a dark mode toggle" \
  "frontend,phase-2,good first issue" \
  "Add a light/dark theme toggle using CSS variables already defined in styles.css; persist the choice in memory for the session."

create "Add a countdown to close_ledger" \
  "frontend,phase-2" \
  "Convert the remaining ledgers until close_ledger into an estimated human-readable time remaining (assume ~5s/ledger) and display it on the market card."

create "Add a countdown to resolve_ledger" \
  "frontend,phase-2" \
  "Same as the close_ledger countdown, but for when the oracle becomes eligible to resolve."

create "Add copy-to-clipboard for the contract ID" \
  "frontend,phase-2,good first issue" \
  "Add a small copy button next to the displayed market/contract ID."

create "Add unit tests for formatAmount and toStroops" \
  "frontend,phase-2,good first issue" \
  "Add a test file (Vitest or similar) covering rounding, zero, and large-value cases for the amount formatting helpers in App.tsx."

create "Add unit tests for normalizeMarket parsing" \
  "frontend,phase-2" \
  "Add tests for the normalizeMarket function in contract.ts against representative raw ScVal-decoded objects for each MarketStatus and Outcome value."

create "Add a React error boundary" \
  "frontend,phase-2,good first issue" \
  "Wrap the app in an error boundary component so an unexpected render error shows a friendly fallback instead of a blank white screen."

create "Accessibility pass: aria-labels and keyboard navigation" \
  "frontend,phase-2" \
  "Add aria-labels to icon-only buttons, ensure the bet form and admin panel are fully keyboard-navigable, and verify visible focus states."

create "Add favicon and page title branding" \
  "frontend,phase-2,good first issue" \
  "Add a favicon and set a descriptive <title> in index.html."

create "Add a \"How this works\" explainer section" \
  "frontend,phase-2,good first issue" \
  "Add a collapsible section or modal explaining the parimutuel payout model in plain language for first-time users."

create "Persist and auto-reconnect the last-used wallet" \
  "frontend,phase-2" \
  "Remember the last connected public key for the session (in-memory only, no localStorage per the artifact constraints if built as one) and attempt silent reconnect on reload."

create "Add a disconnect wallet button" \
  "frontend,phase-2,good first issue" \
  "Add a way to clear the connected wallet state from the UI."

create "Support an additional wallet beyond Freighter" \
  "frontend,phase-2" \
  "Add support for at least one more Stellar wallet (e.g. xBull or Albedo) behind the same wallet.ts interface."

create "Add a historical activity feed from contract events" \
  "frontend,phase-2" \
  "Query and display recent BetPlaced/MarketResolved/Claimed events for the current market as a simple activity log."

create "Add a fee breakdown display in the bet form" \
  "frontend,phase-2,good first issue" \
  "Show the market's fee_bps as a plain-language note near the bet form (e.g. \"5% fee applies only to the losing side\")."

create "Require outcome selection before enabling submit" \
  "frontend,phase-2,good first issue" \
  "Ensure the bet button stays disabled until both a valid amount and an outcome are selected (outcome already defaults to Yes — confirm this is intentional or require explicit selection)."

create "Add ESLint config and CI check" \
  "frontend,phase-2,devex,good first issue" \
  "Add an ESLint config for the frontend and a CI step that fails on lint errors."

create "Add Prettier config and CI check" \
  "frontend,phase-2,devex,good first issue" \
  "Add a Prettier config and a CI step verifying formatting."

create "Add a component preview setup" \
  "frontend,phase-2,devex" \
  "Set up Storybook (or a lightweight alternative) for the bet form, market card, and admin panel components in isolation."

create "Add an e2e test of the full connect-to-claim flow" \
  "frontend,phase-2,devex" \
  "Using Playwright against a local Soroban sandbox and a mocked/test wallet, script through connect wallet -> place bet -> resolve (as oracle) -> claim, asserting balances change as expected."

# --- Phase 3: Multi-market support ---

create "Write a market factory contract" \
  "contract,phase-3" \
  "New contract under contracts/market-factory that stores the prediction-market WASM hash and can deploy new instances."

create "Add create_market to the factory" \
  "contract,phase-3" \
  "Expose create_market(...) on the factory with the same params as this contract's initialize, deploying via env.deployer() and calling initialize on the new instance."

create "Factory: validate parameters before deploying" \
  "contract,phase-3" \
  "Reject create_market calls with a close_ledger in the past or resolve_ledger before close_ledger at the factory level, before wasting a deployment."

create "Factory: maintain an enumerable list of deployed markets" \
  "contract,phase-3" \
  "Store deployed market addresses in a way that supports pagination/listing, not just individual lookups."

create "Factory: emit an event on market creation" \
  "contract,phase-3,good first issue" \
  "Emit a MarketCreated event with the new contract address so off-chain indexers don't need to poll."

create "Factory: unit tests" \
  "contract,phase-3" \
  "Cover successful creation, parameter validation failures, and listing/pagination of created markets."

create "Factory: pagination for large market lists" \
  "contract,phase-3" \
  "Add a paginated read method (e.g. list_markets(start, limit)) once the number of deployed markets could exceed a single call's resource limits."

create "Off-chain indexer script for factory events" \
  "phase-3,devex" \
  "A small Node/TS script that listens to Soroban RPC for MarketCreated events and writes a local JSON/DB list of known markets, for the frontend to optionally use instead of live on-chain calls."

create "Frontend: market list/browse page" \
  "frontend,phase-3" \
  "New page listing all markets known to the factory, showing question, status, and pool sizes, linking to each market's detail view."

create "Frontend: per-market URL routing" \
  "frontend,phase-3" \
  "Add a router so /market/:contractId loads that specific market's detail view and deep links survive a page refresh."

create "Frontend: create-market form for admins" \
  "frontend,phase-3" \
  "A form calling the factory's create_market, collecting question text, close/resolve dates (converted to ledger numbers), token address, and fee."

create "Frontend: filter markets by status" \
  "frontend,phase-3,good first issue" \
  "Add filter controls (Open / Closed / Resolved / Cancelled) to the market list page."

create "Frontend: search markets by question text" \
  "frontend,phase-3,good first issue" \
  "Add a text search box filtering the market list client-side by question substring."

create "Frontend: sort markets by closing soonest" \
  "frontend,phase-3,good first issue" \
  "Add a sort control defaulting to soonest-closing-first on the market list page."

create "Docs: factory deployment guide" \
  "docs,phase-3,good first issue" \
  "Extend docs/DEPLOYMENT.md with the factory's deploy + upload-wasm-hash + create_market steps."

# --- Phase 4: Oracle decentralization ---

create "Design doc: multisig vs voting-contract oracle tradeoffs" \
  "docs,phase-4" \
  "New docs/ORACLE_DESIGN.md comparing a single key, a Stellar-native multisig account, and a dedicated voting/staking contract as the oracle address, with a recommendation."

create "Document Stellar multisig account setup as oracle" \
  "docs,phase-4,good first issue" \
  "Since oracle is just an Address, a classic Stellar multisig account works with zero contract changes — document the setup procedure (adding signers, thresholds) in docs/DEPLOYMENT.md."

create "Implement an N-of-M voting oracle contract" \
  "contract,phase-4" \
  "If the design doc recommends a dedicated contract over a plain multisig account, implement it with configurable signers and threshold."

create "Voting oracle: unit tests" \
  "contract,phase-4" \
  "Cover reaching threshold, a minority failing to force resolution, and duplicate votes from the same signer being rejected."

create "Add dispute_window_ledgers field to Market" \
  "contract,phase-4" \
  "Add the field, settable at initialize(), defaulting to 0 for backward compatibility with the existing test suite."

create "Enforce the dispute window in claim()" \
  "contract,phase-4,security" \
  "claim() should reject with a new error if called before resolve() plus dispute_window_ledgers have passed."

create "Tests for the dispute window boundary" \
  "contract,phase-4,good first issue" \
  "Cover claim() attempts exactly at, one before, and one after the dispute window closes."

create "Frontend: display dispute window countdown" \
  "frontend,phase-4,good first issue" \
  "Show remaining time before claim() becomes available once a market is resolved, if the dispute window is nonzero."

create "Frontend: oracle voting UI" \
  "frontend,phase-4" \
  "If the voting oracle contract is built, add a UI for signers to cast their vote on the outcome."

create "Docs: oracle key-management best practices" \
  "docs,phase-4" \
  "Guidance on custody, backup, and rotation for whichever key(s) control the oracle role."

# --- Phase 5: Advanced market types ---

create "Design doc: generalizing Outcome to N outcomes" \
  "docs,contract,phase-5" \
  "Document the migration from the binary Yes/No enum + fixed total_yes/total_no fields to a u32 index + Vec<i128> pool totals, including that it's a breaking storage change requiring a new contract version."

create "Implement N-outcome Market struct" \
  "contract,phase-5" \
  "Replace Outcome enum and fixed pool fields with a u32 outcome index and Vec<i128> pools per the design doc."

create "Migrate payout math to N outcomes" \
  "contract,phase-5" \
  "Generalize the claim() payout calculation to work over an arbitrary number of pools, with the binary case as N=2."

create "Tests for N-outcome payouts" \
  "contract,phase-5" \
  "Port the existing binary payout tests to run against the generalized N-outcome implementation, plus new tests with 3+ outcomes."

create "Frontend support for N-outcome markets" \
  "frontend,phase-5" \
  "Replace the fixed YES/NO toggle with a dynamic list of outcome buttons driven by the market's outcome count."

create "Design note: LMSR AMM layer" \
  "docs,phase-5" \
  "Where the AMM lives (separate contract holding a position in the pool vs. modifying this contract directly) and why — prefer a separate contract to avoid destabilizing the audited core."

create "Prototype an LMSR AMM contract" \
  "contract,phase-5" \
  "A clearly-marked-experimental contract implementing logarithmic market scoring rule pricing on Testnet."

create "LMSR AMM: unit tests" \
  "contract,phase-5" \
  "Cover price movement on trades, bounded loss for the market maker, and integration with the underlying pool contract."

create "Design note: partial exit mechanism" \
  "docs,phase-5" \
  "Whether partial exit is AMM-backed or peer-to-peer order matching, and the tradeoffs of each, given no exit mechanism exists today."

create "Prototype partial exit" \
  "contract,phase-5" \
  "A clearly-marked-experimental implementation with tests, gated behind the AMM work if that's the chosen mechanism."

# --- Phase 6: Mainnet readiness ---

create "Commission an external security audit" \
  "security,phase-6" \
  "Engage a third-party Soroban/Rust auditor; do not deploy real funds before this is complete. Track findings as linked follow-up issues."

create "Track audit findings as individual issues" \
  "security,phase-6,good first issue" \
  "Meta-issue: once the audit report arrives, break each finding into its own issue with severity labeled."

create "Add monitoring/alerting for stuck markets" \
  "phase-6" \
  "A lightweight off-chain monitor that polls known markets and flags ones past resolve_ledger still Closed with no resolution, alerting via a documented (not hardcoded) channel."

create "Legal/regulatory review checklist" \
  "docs,phase-6" \
  "New docs/LEGAL_CHECKLIST.md listing jurisdiction-dependent questions to run past actual counsel — not legal advice itself."

create "Production deployment runbook" \
  "docs,phase-6" \
  "New docs/RUNBOOK.md covering key management for admin/oracle/fee_recipient roles, fee sweep cadence, compromised-key response, and incident response steps."

create "Admin/oracle key management guide" \
  "docs,phase-6,security" \
  "Recommend hardware wallet or multisig custody for the admin and oracle roles before mainnet use, with concrete setup steps."

create "Rate-limiting / abuse review for frontend RPC usage" \
  "phase-6" \
  "Review how often the frontend polls Soroban RPC (getMarket/getPosition/getImpliedYesBps) and add debouncing or caching if it could hit provider rate limits at scale."

create "Add a mainnet-specific .env template" \
  "devex,phase-6,good first issue" \
  "A frontend/.env.mainnet.example with PUBLIC network defaults and a mainnet RPC provider placeholder."

create "Basic post-launch monitoring dashboard" \
  "phase-6" \
  "A simple read-only page or script summarizing all known markets' status, pool sizes, and time-to-resolution for operational visibility."

create "Incident response plan" \
  "docs,phase-6,security" \
  "Document the steps to take if a bug is discovered in a live market with funds at risk (who to contact, whether admin can cancel, communication plan)."

# --- Phase 7: Community & developer experience ---

create "Add a LICENSE file" \
  "phase-7,devex,good first issue" \
  "Pick and add an actual license (MIT is referenced in the README but no LICENSE file exists yet)."

create "Add CODE_OF_CONDUCT.md" \
  "phase-7,devex,good first issue" \
  "Add a standard code of conduct (e.g. Contributor Covenant) for the repo."

create "Add a pull request template" \
  "phase-7,devex,good first issue" \
  "Add .github/PULL_REQUEST_TEMPLATE.md prompting for a description, related issue, and testing performed."

create "Add an issue triage guide for maintainers" \
  "docs,phase-7,devex" \
  "Document how incoming issues should be labeled, prioritized, and assigned to phases/milestones."

create "Replace the ASCII architecture diagram with a real image" \
  "docs,phase-7,devex" \
  "Render the state-machine and component diagrams in docs/ARCHITECTURE.md as actual images (e.g. via Mermaid or an exported diagram) for readability."

create "Add a FAQ document" \
  "docs,phase-7,devex,good first issue" \
  "New docs/FAQ.md answering common setup and conceptual questions gathered from issues/discussions."

create "Add a Stellar/Soroban glossary for newcomers" \
  "docs,phase-7,devex,good first issue" \
  "New docs/GLOSSARY.md defining terms like SAC, ledger sequence, XDR, and SEP-41 for contributors new to Stellar."

create "Add a one-command local setup script" \
  "phase-7,devex,good first issue" \
  "A Makefile or npm script that builds the contract, runs tests, installs frontend deps, and starts the dev server in one command."

create "Add Docker Compose for a local Soroban sandbox" \
  "phase-7,devex" \
  "A docker-compose.yml that spins up a local Soroban RPC/sandbox so contributors can test without hitting Testnet."

create "Add CHANGELOG.md and a keep-a-changelog process" \
  "phase-7,devex,good first issue" \
  "Add an initial CHANGELOG.md following the Keep a Changelog format and document the process for updating it in CONTRIBUTING.md."

create "Document a versioning/release process" \
  "docs,phase-7,devex" \
  "Decide on and document semantic versioning for contract releases, given that storage-breaking changes (like the N-outcome migration) can't be upgraded in place."

create "Audit all good-first-issue labels for accuracy" \
  "phase-7,devex" \
  "Review every issue labeled good first issue and confirm it's genuinely small and well-scoped for a newcomer; relabel any that aren't."

create "Add a Discord/Telegram community link to the README" \
  "phase-7,devex,good first issue" \
  "Once a community channel exists, add it to the README so contributors have a place to ask questions."

create "Add i18n scaffold for frontend copy" \
  "frontend,phase-7,devex" \
  "Extract user-facing strings in App.tsx into a translation-ready structure, even if only English is populated initially."

create "Add a repo-level status badges section to README" \
  "phase-7,devex,good first issue" \
  "Add CI status, license, and test coverage badges to the top of README.md once CI workflows exist."

echo "Done. Filed 115 issues. Review them at: gh issue list --limit 200"
