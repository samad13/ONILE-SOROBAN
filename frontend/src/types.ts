export type Outcome = "Yes" | "No";

export type MarketStatus = "Open" | "Closed" | "Resolved" | "Cancelled";

export interface Market {
  admin: string;
  oracle: string;
  token: string;
  question: string;
  closeLedger: number;
  resolveLedger: number;
  status: MarketStatus;
  winner: Outcome | null;
  totalYes: bigint;
  totalNo: bigint;
  feeBps: number;
  feeRecipient: string;
}

export interface Position {
  yesStake: bigint;
  noStake: bigint;
}

export interface AppConfig {
  network: "TESTNET" | "PUBLIC" | "FUTURENET";
  networkPassphrase: string;
  rpcUrl: string;
  contractId: string;
}
