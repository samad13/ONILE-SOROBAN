import {
  isConnected,
  isAllowed,
  setAllowed,
  requestAccess,
  getAddress,
  signTransaction,
} from "@stellar/freighter-api";
import { config } from "../config";

export interface ConnectedWallet {
  publicKey: string;
}

/** Prompts the user to connect Freighter (or another supported wallet
 * extension) and returns their public key. Throws if Freighter is not
 * installed or the user rejects the connection. */
export async function connectWallet(): Promise<ConnectedWallet> {
  const available = await isConnected();
  if (!available.isConnected) {
    throw new Error("Freighter wallet extension is not installed.");
  }

  const allowed = await isAllowed();
  if (!allowed.isAllowed) {
    const access = await requestAccess();
    if (access.error) {
      throw new Error(access.error);
    }
    await setAllowed();
  }

  const result = await getAddress();
  if (result.error) {
    throw new Error(result.error);
  }
  return { publicKey: result.address };
}

/** Signs an XDR transaction envelope with the connected wallet and returns
 * the signed XDR, ready to submit to RPC. */
export async function signXdr(xdr: string, publicKey: string): Promise<string> {
  const result = await signTransaction(xdr, {
    networkPassphrase: config.networkPassphrase,
    address: publicKey,
  });
  if (result.error) {
    throw new Error(result.error);
  }
  return result.signedTxXdr;
}
