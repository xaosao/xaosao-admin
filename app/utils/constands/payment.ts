/**
 * Payment method constants, shared by the server service and the settings
 * UI.
 *
 * Deliberately NOT in `payment-method.server.ts`: the settings page reads
 * `CRYPTO_NETWORKS` while rendering, and Remix refuses to let client code
 * import from a `.server` module. Keeping the data here and the database
 * work there is what lets both sides use the same list.
 */

/**
 * Networks we accept, with the address shape each uses.
 *
 * BEP20 is the default: it is Binance Smart Chain, which is what a
 * Binance withdrawal address looks like by default. BEP20 and ERC20 are
 * both EVM chains, so they share the 0x… form — an address pasted for the
 * wrong one of those two will pass validation. Only the network label
 * tells them apart, which is why it is shown to the customer.
 */
export const CRYPTO_NETWORKS = {
  BEP20: {
    label: "BEP20 (Binance Smart Chain)",
    pattern: /^0x[a-fA-F0-9]{40}$/,
    example: "0x1a2b3c…",
  },
  ERC20: {
    label: "ERC20 (Ethereum)",
    pattern: /^0x[a-fA-F0-9]{40}$/,
    example: "0x1a2b3c…",
  },
  TRC20: {
    label: "TRC20 (Tron)",
    pattern: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
    example: "TQ5…",
  },
} as const;

export type CryptoNetwork = keyof typeof CRYPTO_NETWORKS;

export interface PaymentMethods {
  bankEnabled: boolean;
  bankQrCode: string;
  cryptoEnabled: boolean;
  cryptoAddress: string;
  cryptoNetwork: CryptoNetwork;
  /**
   * Kip per 1 USD, used to price the crypto flow in dollars.
   *
   * Set by hand rather than fetched: it only has to be roughly right,
   * and an admin confirms the exact kip credited when approving the
   * top-up anyway.
   */
  usdRate: number;
}

/** Used until an admin saves a rate of their own. */
export const DEFAULT_USD_RATE = 21_500;
