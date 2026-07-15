//! # Prediction Market Contract
//!
//! A binary-outcome (YES/NO), parimutuel-style prediction market for Stellar
//! Soroban.
//!
//! ## Model
//! - Users deposit an SEP-41 compatible token (e.g. USDC, XLM SAC) onto
//!   either the YES or NO side before `close_ledger`.
//! - After `close_ledger`, trading stops and the market waits for
//!   resolution.
//! - The `oracle` address (can be a multisig, another contract, or a DAO)
//!   submits the winning outcome via `resolve`.
//! - Winners split the entire losing pool pro-rata to their stake in the
//!   winning pool, minus an optional protocol fee.
//! - If the market is cancelled before resolution, everyone can reclaim
//!   their original stake.
//!
//! This is intentionally a "parimutuel" design (like a horse-racing pool)
//! rather than an AMM/order-book design, because it needs no external price
//! curve and has no risk of impermanent-loss-style bugs. It's the simplest
//! correct primitive to build a market on top of; an AMM layer can be
//! added later by having the AMM contract itself be "a user" of this pool.

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env,
    String, Symbol,
};

// -------------------------------------------------------------------------
// Storage keys
// -------------------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Market configuration & mutable state, see [`Market`].
    Market,
    /// Per-user stake on the YES side.
    YesStake(Address),
    /// Per-user stake on the NO side.
    NoStake(Address),
    /// Whether a user has already claimed their payout / refund.
    Claimed(Address),
}

// -------------------------------------------------------------------------
// Core data
// -------------------------------------------------------------------------

#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub enum Outcome {
    Yes,
    No,
}

#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub enum MarketStatus {
    /// Accepting bets.
    Open,
    /// Trading closed, awaiting oracle resolution.
    Closed,
    /// Oracle has submitted a final outcome; claims are open.
    Resolved,
    /// Admin cancelled the market; stakes are refundable.
    Cancelled,
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct Market {
    pub admin: Address,
    pub oracle: Address,
    pub token: Address,
    pub question: String,
    /// Ledger sequence after which betting is no longer allowed.
    pub close_ledger: u32,
    /// Ledger sequence after which the oracle may resolve. Gives a buffer
    /// after `close_ledger` for the real-world event to actually conclude.
    pub resolve_ledger: u32,
    pub status: MarketStatus,
    pub winner: Option<Outcome>,
    pub total_yes: i128,
    pub total_no: i128,
    /// Protocol fee in basis points (1/100 of a percent), taken only from
    /// the losing pool on a successful resolution. Max 1000 (10%).
    pub fee_bps: u32,
    pub fee_recipient: Address,
}

// -------------------------------------------------------------------------
// Events
// -------------------------------------------------------------------------

#[contractevent]
#[derive(Clone)]
pub struct BetPlaced {
    #[topic]
    pub user: Address,
    pub outcome: Outcome,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone)]
pub struct MarketResolved {
    pub winner: Outcome,
}

#[contractevent]
#[derive(Clone)]
pub struct MarketCancelled;

#[contractevent]
#[derive(Clone)]
pub struct Claimed {
    #[topic]
    pub user: Address,
    pub amount: i128,
}

// -------------------------------------------------------------------------
// Errors
// -------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    MarketNotOpen = 3,
    MarketNotClosed = 4,
    MarketNotResolved = 5,
    MarketNotCancelled = 6,
    TooEarlyToResolve = 7,
    ZeroAmount = 8,
    NothingToClaim = 9,
    AlreadyClaimed = 10,
    FeeTooHigh = 11,
    NotOracle = 12,
    NotAdmin = 13,
    InvalidLedgers = 14,
}

const MAX_FEE_BPS: u32 = 1000; // 10%

#[contract]
pub struct PredictionMarket;

#[contractimpl]
impl PredictionMarket {
    /// Create a new market. Can only be called once per contract instance
    /// (deploy one contract instance per market).
    pub fn initialize(
        env: Env,
        admin: Address,
        oracle: Address,
        token: Address,
        question: String,
        close_ledger: u32,
        resolve_ledger: u32,
        fee_bps: u32,
        fee_recipient: Address,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Market) {
            return Err(Error::AlreadyInitialized);
        }
        if fee_bps > MAX_FEE_BPS {
            return Err(Error::FeeTooHigh);
        }
        let current_ledger = env.ledger().sequence();
        if close_ledger <= current_ledger || resolve_ledger < close_ledger {
            return Err(Error::InvalidLedgers);
        }

        admin.require_auth();

        let market = Market {
            admin,
            oracle,
            token,
            question,
            close_ledger,
            resolve_ledger,
            status: MarketStatus::Open,
            winner: None,
            total_yes: 0,
            total_no: 0,
            fee_bps,
            fee_recipient,
        };
        env.storage().instance().set(&DataKey::Market, &market);
        // Bump instance TTL generously; adjust for your expected market
        // lifetime. See Soroban state-expiration docs.
        env.storage().instance().extend_ttl(500_000, 500_000);
        Ok(())
    }

    /// Place (or add to) a bet on `outcome` for `amount` of the market's
    /// token. Requires the caller's authorization and a prior `approve`
    /// (or sufficient allowance) if using an SAC/SEP-41 token.
    pub fn bet(env: Env, user: Address, outcome: Outcome, amount: i128) -> Result<(), Error> {
        user.require_auth();
        if amount <= 0 {
            return Err(Error::ZeroAmount);
        }

        let mut market = Self::get_market(env.clone())?;
        Self::refresh_status(&env, &mut market);
        if market.status != MarketStatus::Open {
            return Err(Error::MarketNotOpen);
        }

        // Pull funds into the contract escrow.
        let token_client = token::Client::new(&env, &market.token);
        token_client.transfer(&user, &env.current_contract_address(), &amount);

        let key = match outcome {
            Outcome::Yes => DataKey::YesStake(user.clone()),
            Outcome::No => DataKey::NoStake(user.clone()),
        };
        let prior: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(prior + amount));
        env.storage().persistent().extend_ttl(&key, 500_000, 500_000);

        match outcome {
            Outcome::Yes => market.total_yes += amount,
            Outcome::No => market.total_no += amount,
        }
        env.storage().instance().set(&DataKey::Market, &market);

        BetPlaced {
            user,
            outcome,
            amount,
        }
        .publish(&env);
        Ok(())
    }

    /// Oracle submits the final outcome. Only callable after
    /// `resolve_ledger`.
    pub fn resolve(env: Env, caller: Address, winner: Outcome) -> Result<(), Error> {
        caller.require_auth();
        let mut market = Self::get_market(env.clone())?;
        if caller != market.oracle {
            return Err(Error::NotOracle);
        }
        Self::refresh_status(&env, &mut market);
        if market.status != MarketStatus::Closed {
            return Err(Error::MarketNotClosed);
        }
        if env.ledger().sequence() < market.resolve_ledger {
            return Err(Error::TooEarlyToResolve);
        }

        market.status = MarketStatus::Resolved;
        market.winner = Some(winner.clone());
        env.storage().instance().set(&DataKey::Market, &market);

        MarketResolved { winner }.publish(&env);
        Ok(())
    }

    /// Admin can cancel the market at any time before it is resolved,
    /// enabling full refunds. Use for oracle failure / disputed events.
    pub fn cancel(env: Env, caller: Address) -> Result<(), Error> {
        caller.require_auth();
        let mut market = Self::get_market(env.clone())?;
        if caller != market.admin {
            return Err(Error::NotAdmin);
        }
        if market.status == MarketStatus::Resolved {
            return Err(Error::MarketNotOpen);
        }
        market.status = MarketStatus::Cancelled;
        env.storage().instance().set(&DataKey::Market, &market);
        MarketCancelled.publish(&env);
        Ok(())
    }

    /// Claim winnings (if resolved) or a refund (if cancelled). Safe to
    /// call once; a second call returns `AlreadyClaimed`.
    pub fn claim(env: Env, user: Address) -> Result<i128, Error> {
        user.require_auth();
        let mut market = Self::get_market(env.clone())?;
        Self::refresh_status(&env, &mut market);

        let claimed_key = DataKey::Claimed(user.clone());
        if env.storage().persistent().has(&claimed_key) {
            return Err(Error::AlreadyClaimed);
        }

        let yes_key = DataKey::YesStake(user.clone());
        let no_key = DataKey::NoStake(user.clone());
        let yes_stake: i128 = env.storage().persistent().get(&yes_key).unwrap_or(0);
        let no_stake: i128 = env.storage().persistent().get(&no_key).unwrap_or(0);

        let payout: i128 = match market.status {
            MarketStatus::Cancelled => yes_stake + no_stake,
            MarketStatus::Resolved => {
                let winner = market.winner.clone().ok_or(Error::MarketNotResolved)?;
                let (winning_stake, winning_pool, losing_pool) = match winner {
                    Outcome::Yes => (yes_stake, market.total_yes, market.total_no),
                    Outcome::No => (no_stake, market.total_no, market.total_yes),
                };
                if winning_stake == 0 || winning_pool == 0 {
                    0
                } else {
                    // Fee is taken only from the losing pool before it is
                    // distributed to winners; principal is always returned
                    // in full.
                    let fee = (losing_pool * market.fee_bps as i128) / 10_000;
                    let distributable_losing_pool = losing_pool - fee;
                    let winnings = (distributable_losing_pool * winning_stake) / winning_pool;
                    winning_stake + winnings
                }
            }
            _ => return Err(Error::MarketNotResolved),
        };

        if payout == 0 {
            return Err(Error::NothingToClaim);
        }

        env.storage().persistent().set(&claimed_key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&claimed_key, 500_000, 500_000);

        let token_client = token::Client::new(&env, &market.token);
        token_client.transfer(&env.current_contract_address(), &user, &payout);

        // Pay the protocol fee out once, lazily, on the first resolved
        // claim after it becomes computable. Simpler alternative: sweep
        // fees separately via `sweep_fee` (see below) to avoid repeated
        // recomputation here.

        Claimed {
            user,
            amount: payout,
        }
        .publish(&env);
        Ok(payout)
    }

    /// Admin/fee-recipient sweeps the accumulated protocol fee after
    /// resolution. Idempotent: computes the fee directly from the losing
    /// pool and pays it once by tracking a `FeeSwept` flag.
    pub fn sweep_fee(env: Env, caller: Address) -> Result<i128, Error> {
        caller.require_auth();
        let market = Self::get_market(env.clone())?;
        if caller != market.fee_recipient {
            return Err(Error::NotAdmin);
        }
        if market.status != MarketStatus::Resolved {
            return Err(Error::MarketNotResolved);
        }
        let swept_key = Symbol::new(&env, "fee_swept");
        if env.storage().instance().has(&swept_key) {
            return Err(Error::AlreadyClaimed);
        }
        let winner = market.winner.clone().ok_or(Error::MarketNotResolved)?;
        let losing_pool = match winner {
            Outcome::Yes => market.total_no,
            Outcome::No => market.total_yes,
        };
        let fee = (losing_pool * market.fee_bps as i128) / 10_000;
        if fee == 0 {
            return Err(Error::NothingToClaim);
        }
        env.storage().instance().set(&swept_key, &true);
        let token_client = token::Client::new(&env, &market.token);
        token_client.transfer(&env.current_contract_address(), &caller, &fee);
        Ok(fee)
    }

    // ---------------------------------------------------------------
    // Read-only views
    // ---------------------------------------------------------------

    pub fn get_market(env: Env) -> Result<Market, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Market)
            .ok_or(Error::NotInitialized)
    }

    /// Returns (yes_stake, no_stake) for a user.
    pub fn get_position(env: Env, user: Address) -> (i128, i128) {
        let yes: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::YesStake(user.clone()))
            .unwrap_or(0);
        let no: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::NoStake(user))
            .unwrap_or(0);
        (yes, no)
    }

    /// Current implied probability of YES, scaled to basis points
    /// (0-10000), based purely on pool sizes. This is a naive estimator,
    /// not a real price feed.
    pub fn implied_yes_bps(env: Env) -> Result<u32, Error> {
        let market = Self::get_market(env)?;
        let total = market.total_yes + market.total_no;
        if total == 0 {
            return Ok(5000);
        }
        Ok(((market.total_yes * 10_000) / total) as u32)
    }

    // ---------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------

    /// Lazily flips Open -> Closed once `close_ledger` has passed, without
    /// requiring a separate transaction. Does not persist by itself;
    /// callers that mutate market state must write it back.
    fn refresh_status(env: &Env, market: &mut Market) {
        if market.status == MarketStatus::Open && env.ledger().sequence() >= market.close_ledger {
            market.status = MarketStatus::Closed;
        }
    }
}

mod test;
