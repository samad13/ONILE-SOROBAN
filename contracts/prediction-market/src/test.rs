#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{token::StellarAssetClient, Env};

fn advance_ledger(env: &Env, to: u32) {
    env.ledger().with_mut(|li| li.sequence_number = to);
}

fn setup(env: &Env) -> (Address, Address, Address, Address) {
    let admin = Address::generate(env);
    let oracle = Address::generate(env);
    let token_admin = Address::generate(env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    (admin, oracle, token_admin, token_contract.address())
}

#[test]
fn full_lifecycle_yes_wins() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, oracle, token_admin, token) = setup(&env);
    let sac = StellarAssetClient::new(&env, &token);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    sac.mint(&alice, &1_000);
    sac.mint(&bob, &1_000);
    let _ = token_admin; // silence unused warning when not asserting admin balance

    let contract_id = env.register(PredictionMarket, ());
    let client = PredictionMarketClient::new(&env, &contract_id);

    let fee_recipient = Address::generate(&env);
    client.initialize(
        &admin,
        &oracle,
        &token,
        &String::from_str(&env, "Will it rain tomorrow?"),
        &100, // close_ledger
        &200, // resolve_ledger
        &500, // 5% fee
        &fee_recipient,
    );

    client.bet(&alice, &Outcome::Yes, &100);
    client.bet(&bob, &Outcome::No, &50);

    advance_ledger(&env, 150); // past close_ledger, before resolve_ledger

    let market = client.get_market();
    assert_eq!(market.total_yes, 100);
    assert_eq!(market.total_no, 50);

    advance_ledger(&env, 201); // past resolve_ledger
    client.resolve(&oracle, &Outcome::Yes);

    let payout = client.claim(&alice);
    // losing pool = 50, fee = 5% of 50 = 2 (integer division), distributable = 48
    // alice owns 100% of winning pool -> gets 100 + 48 = 148
    assert_eq!(payout, 148);

    let fee = client.sweep_fee(&fee_recipient);
    assert_eq!(fee, 2);
}

#[test]
fn cancelled_market_refunds_stake() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, oracle, _token_admin, token) = setup(&env);
    let sac = StellarAssetClient::new(&env, &token);
    let alice = Address::generate(&env);
    sac.mint(&alice, &500);

    let contract_id = env.register(PredictionMarket, ());
    let client = PredictionMarketClient::new(&env, &contract_id);
    let fee_recipient = Address::generate(&env);

    client.initialize(
        &admin,
        &oracle,
        &token,
        &String::from_str(&env, "Will X happen?"),
        &100,
        &200,
        &0,
        &fee_recipient,
    );

    client.bet(&alice, &Outcome::Yes, &200);
    client.cancel(&admin);

    let refund = client.claim(&alice);
    assert_eq!(refund, 200);
}
