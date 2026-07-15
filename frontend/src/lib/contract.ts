import {
  Contract,
  rpc as SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  Address,
  xdr,
  type Transaction,
} from "@stellar/stellar-sdk";
import { config } from "../config";
import { signXdr } from "./wallet";
import type { Market, Outcome, Position } from "../types";

const server = new SorobanRpc.Server(config.rpcUrl);

function outcomeToScVal(outcome: Outcome): xdr.ScVal {
  // Matches the Rust enum: pub enum Outcome { Yes, No } — a unit enum is
  // represented as a vec with a single symbol in Soroban's SDK-generated
  // XDR convention.
  return nativeToScVal(outcome, { type: "symbol" });
}

/** Builds, simulates, and (for write calls) signs + submits a contract
 * invocation. Read-only calls should pass `submit: false`. */
async function invoke<T>(opts: {
  method: string;
  args: xdr.ScVal[];
  sourcePublicKey: string;
  submit: boolean;
}): Promise<T> {
  const { method, args, sourcePublicKey, submit } = opts;
  if (!config.contractId) {
    throw new Error("Contract ID not configured. Set VITE_MARKET_CONTRACT_ID.");
  }

  const account = await server.getAccount(sourcePublicKey);
  const contract = new Contract(config.contractId);

  let tx: Transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  const simulated = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simulated)) {
    throw new Error(`Simulation failed for ${method}: ${simulated.error}`);
  }

  if (!submit) {
    if (!SorobanRpc.Api.isSimulationSuccess(simulated) || !simulated.result) {
      throw new Error(`No result returned for read-only call ${method}`);
    }
    return scValToNative(simulated.result.retval) as T;
  }

  const prepared = SorobanRpc.assembleTransaction(tx, simulated).build();
  const signedXdr = await signXdr(prepared.toXDR(), sourcePublicKey);
  const signedTx = TransactionBuilder.fromXDR(
    signedXdr,
    config.networkPassphrase,
  ) as Transaction;

  const sendResult = await server.sendTransaction(signedTx);
  if (sendResult.status === "ERROR") {
    throw new Error(`Submission failed for ${method}: ${JSON.stringify(sendResult.errorResult)}`);
  }

  const result = await pollTransaction(sendResult.hash);
  if (result.status !== "SUCCESS") {
    throw new Error(`Transaction ${sendResult.hash} did not succeed: ${result.status}`);
  }
  if (result.returnValue) {
    return scValToNative(result.returnValue) as T;
  }
  return undefined as T;
}

async function pollTransaction(
  hash: string,
  attempts = 15,
  delayMs = 1500,
): Promise<SorobanRpc.Api.GetTransactionResponse> {
  for (let i = 0; i < attempts; i++) {
    const res = await server.getTransaction(hash);
    if (res.status !== SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
      return res;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Timed out waiting for transaction ${hash} to confirm.`);
}

// ---------------------------------------------------------------------
// Public API — one function per contract method
// ---------------------------------------------------------------------

export async function getMarket(sourcePublicKey: string): Promise<Market> {
  const raw = await invoke<Record<string, unknown>>({
    method: "get_market",
    args: [],
    sourcePublicKey,
    submit: false,
  });
  return normalizeMarket(raw);
}

export async function getPosition(
  sourcePublicKey: string,
  user: string,
): Promise<Position> {
  const [yesStake, noStake] = await invoke<[bigint, bigint]>({
    method: "get_position",
    args: [new Address(user).toScVal()],
    sourcePublicKey,
    submit: false,
  });
  return { yesStake, noStake };
}

export async function getImpliedYesBps(sourcePublicKey: string): Promise<number> {
  return invoke<number>({
    method: "implied_yes_bps",
    args: [],
    sourcePublicKey,
    submit: false,
  });
}

export async function placeBet(
  userPublicKey: string,
  outcome: Outcome,
  amount: bigint,
): Promise<void> {
  await invoke<void>({
    method: "bet",
    args: [new Address(userPublicKey).toScVal(), outcomeToScVal(outcome), nativeToScVal(amount, { type: "i128" })],
    sourcePublicKey: userPublicKey,
    submit: true,
  });
}

export async function claim(userPublicKey: string): Promise<bigint> {
  return invoke<bigint>({
    method: "claim",
    args: [new Address(userPublicKey).toScVal()],
    sourcePublicKey: userPublicKey,
    submit: true,
  });
}

export async function resolveMarket(
  oraclePublicKey: string,
  winner: Outcome,
): Promise<void> {
  await invoke<void>({
    method: "resolve",
    args: [new Address(oraclePublicKey).toScVal(), outcomeToScVal(winner)],
    sourcePublicKey: oraclePublicKey,
    submit: true,
  });
}

export async function cancelMarket(adminPublicKey: string): Promise<void> {
  await invoke<void>({
    method: "cancel",
    args: [new Address(adminPublicKey).toScVal()],
    sourcePublicKey: adminPublicKey,
    submit: true,
  });
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function normalizeMarket(raw: Record<string, unknown>): Market {
  // scValToNative turns the Rust `Market` struct into a plain object keyed
  // by its field names (soroban-sdk contracttype derives this mapping).
  const statusKey = Object.keys(raw.status as object)[0];
  const winnerRaw = raw.winner as { Yes?: unknown; No?: unknown } | null;
  return {
    admin: (raw.admin as Address).toString(),
    oracle: (raw.oracle as Address).toString(),
    token: (raw.token as Address).toString(),
    question: raw.question as string,
    closeLedger: Number(raw.close_ledger),
    resolveLedger: Number(raw.resolve_ledger),
    status: statusKey as Market["status"],
    winner: winnerRaw ? (Object.keys(winnerRaw)[0] as Outcome) : null,
    totalYes: BigInt(raw.total_yes as bigint),
    totalNo: BigInt(raw.total_no as bigint),
    feeBps: Number(raw.fee_bps),
    feeRecipient: (raw.fee_recipient as Address).toString(),
  };
}
