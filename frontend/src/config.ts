import { Networks } from "@stellar/stellar-sdk";
import type { AppConfig } from "./types";

// Pull from Vite env vars (define these in a .env file, see README).
// Falling back to sane Testnet defaults for local development.
export const config: AppConfig = {
  network: (import.meta.env.VITE_STELLAR_NETWORK as AppConfig["network"]) ?? "TESTNET",
  networkPassphrase:
    (import.meta.env.VITE_STELLAR_NETWORK as string) === "PUBLIC"
      ? Networks.PUBLIC
      : Networks.TESTNET,
  rpcUrl: import.meta.env.VITE_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org",
  contractId: import.meta.env.VITE_MARKET_CONTRACT_ID ?? "",
};

if (!config.contractId) {
  // eslint-disable-next-line no-console
  console.warn(
    "VITE_MARKET_CONTRACT_ID is not set. Deploy the contract and set it in frontend/.env",
  );
}
