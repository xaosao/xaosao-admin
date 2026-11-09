/**
 * Customer payment methods — what a customer can pay you with when they
 * top up their wallet.
 *
 * Two methods: a bank QR code, and a crypto wallet address.
 *
 * Stored in `system_config` rather than the `setting` document on purpose.
 * `system_config.payment_qr_code` is the key xaosao-client already reads
 * on the top-up screen; the `setting` document's `qr_code` field is read
 * by nothing and its row does not even exist. Writing anywhere else would
 * have produced a settings page that looked saved and changed nothing.
 */

import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";
import { FieldValidationError } from "./admin.server";
import { uploadFileToBunnyServer } from "./upload.server";
import {
  CRYPTO_NETWORKS,
  DEFAULT_USD_RATE,
  type CryptoNetwork,
  type PaymentMethods,
} from "~/utils/constands/payment";


/** The key xaosao-client's top-up screen already reads. Do not rename. */
const KEY_BANK_QR = "payment_qr_code";
const KEY_BANK_ENABLED = "payment_bank_enabled";
const KEY_CRYPTO_ENABLED = "payment_crypto_enabled";
const KEY_CRYPTO_ADDRESS = "payment_crypto_address";
const KEY_CRYPTO_NETWORK = "payment_crypto_network";
const KEY_USD_RATE = "payment_usd_rate";

export interface PaymentMethodsInput {
  bankEnabled: boolean;
  /** Existing CDN URL, kept when no new file is uploaded. */
  bankQrCode: string;
  bankQrFile?: File;
  cryptoEnabled: boolean;
  cryptoAddress: string;
  cryptoNetwork: string;
  usdRate: number;
}

async function readConfig(): Promise<Record<string, string>> {
  const rows = await prisma.system_config.findMany({
    where: {
      key: {
        in: [
          KEY_BANK_QR,
          KEY_BANK_ENABLED,
          KEY_CRYPTO_ENABLED,
          KEY_CRYPTO_ADDRESS,
          KEY_CRYPTO_NETWORK,
          KEY_USD_RATE,
        ],
      },
    },
    select: { key: true, value: true },
  });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function getPaymentMethods(): Promise<PaymentMethods> {
  const cfg = await readConfig();
  const network = (cfg[KEY_CRYPTO_NETWORK] as CryptoNetwork) || "BEP20";

  return {
    // Bank defaults to on: a QR has been configured for a while and
    // turning it off silently on first load would break top-ups.
    bankEnabled: cfg[KEY_BANK_ENABLED] !== "false",
    bankQrCode: cfg[KEY_BANK_QR] ?? "",
    cryptoEnabled: cfg[KEY_CRYPTO_ENABLED] === "true",
    cryptoAddress: cfg[KEY_CRYPTO_ADDRESS] ?? "",
    cryptoNetwork: network in CRYPTO_NETWORKS ? network : "BEP20",
    usdRate: Number(cfg[KEY_USD_RATE]) > 0
      ? Number(cfg[KEY_USD_RATE])
      : DEFAULT_USD_RATE,
  };
}

/**
 * Clean up an address the way it actually arrives from a paste.
 *
 * Wallet apps and exchanges hand out addresses in several shapes, and a
 * plain `.trim()` rejects most of them for no good reason:
 *   - copied from a QR scanner → `ethereum:0xabc…?value=0`
 *   - copied from a UI that wraps → a space or newline in the middle
 *   - copied from a chat app → a zero-width character tagging along
 *
 * None of those change the address, so strip them rather than make an
 * admin hunt for an invisible character.
 */
function sanitiseAddress(raw: string): string {
  return (raw ?? "")
    // Payment-URI prefixes: ethereum:, bnb:, tron:, bitcoin: …
    .replace(/^[a-z]+:/i, "")
    // Anything after a URI query separator is parameters, not address.
    .split("?")[0]
    // Zero-width space / joiner / BOM, invisible and impossible to spot.
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    // Every kind of whitespace, including inside a wrapped paste.
    .replace(/\s+/g, "");
}

async function putConfig(key: string, value: string, description: string) {
  await prisma.system_config.upsert({
    where: { key },
    update: { value, updatedAt: new Date() },
    create: { key, value, description },
  });
}

export async function savePaymentMethods(
  data: PaymentMethodsInput,
  userId: string
): Promise<PaymentMethods> {
  const errors: Record<string, string> = {};

  // Upload first, so validation judges the QR that will actually be saved.
  let qrUrl = data.bankQrCode ?? "";
  if (data.bankQrFile && data.bankQrFile.size > 0) {
    const buffer = Buffer.from(await data.bankQrFile.arrayBuffer());
    const ext = data.bankQrFile.name.split(".").pop() || "png";
    qrUrl = await uploadFileToBunnyServer(
      buffer,
      `payment-qr-${Date.now()}.${ext}`,
      data.bankQrFile.type
    );
  }

  const network = (data.cryptoNetwork || "BEP20") as CryptoNetwork;
  const address = sanitiseAddress(data.cryptoAddress);

  if (data.bankEnabled && !qrUrl) {
    errors.bankQrCode = "Upload a QR code, or turn the bank method off.";
  }

  if (data.cryptoEnabled) {
    if (!(network in CRYPTO_NETWORKS)) {
      errors.cryptoNetwork = "Choose a supported network.";
    } else if (!address) {
      errors.cryptoAddress =
        "Enter a wallet address, or turn the crypto method off.";
    } else if (!CRYPTO_NETWORKS[network].pattern.test(address)) {
      // Say what was actually received. "Doesn't look right" sends an
      // admin hunting; "44 characters, expected 42" ends it immediately.
      const expected =
        network === "TRC20"
          ? "34 characters starting with T"
          : "42 characters starting with 0x";
      const looksLikeOtherChain =
        network === "TRC20"
          ? /^0x/i.test(address)
          : /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);

      errors.cryptoAddress = looksLikeOtherChain
        ? `That address belongs to a different chain. You selected ${network}, but the address looks like ${network === "TRC20" ? "an EVM (BEP20/ERC20)" : "a TRC20 (Tron)"} one.`
        : `That is not a valid ${network} address. Expected ${expected}; got ${address.length} character${address.length === 1 ? "" : "s"}${address ? ` starting "${address.slice(0, 6)}"` : ""}.`;
    }
  }

  // Only matters when crypto is on — it is what prices the dollar amounts
  // a foreign customer sees.
  if (data.cryptoEnabled && (!Number.isFinite(data.usdRate) || data.usdRate <= 0)) {
    errors.usdRate = "Enter how many kip one US dollar is worth.";
  }

  // Money cannot reach you with both switched off, so refuse rather than
  // leave the top-up screen with nothing on it.
  if (!data.bankEnabled && !data.cryptoEnabled) {
    errors.bankEnabled = "Keep at least one payment method switched on.";
  }

  if (Object.keys(errors).length > 0) {
    throw new FieldValidationError(errors);
  }

  await Promise.all([
    putConfig(
      KEY_BANK_ENABLED,
      data.bankEnabled ? "true" : "false",
      "Show the bank QR code on the customer top-up screen"
    ),
    putConfig(KEY_BANK_QR, qrUrl, "Bank QR code shown to customers"),
    putConfig(
      KEY_CRYPTO_ENABLED,
      data.cryptoEnabled ? "true" : "false",
      "Show the crypto wallet address on the customer top-up screen"
    ),
    putConfig(
      KEY_CRYPTO_ADDRESS,
      address,
      "Crypto wallet address shown to customers"
    ),
    putConfig(KEY_CRYPTO_NETWORK, network, "Network of the crypto address"),
    putConfig(
      KEY_USD_RATE,
      String(data.usdRate > 0 ? data.usdRate : DEFAULT_USD_RATE),
      "Kip per 1 USD, used to price the crypto top-up flow"
    ),
  ]);

  await createAuditLogs({
    action: "UPDATE_PAYMENT_METHODS",
    user: userId,
    description: `Payment methods updated. Bank: ${
      data.bankEnabled ? "on" : "off"
    }. Crypto: ${data.cryptoEnabled ? `on (${network})` : "off"}.`,
    status: "success",
    onSuccess: {
      bankEnabled: data.bankEnabled,
      cryptoEnabled: data.cryptoEnabled,
      cryptoNetwork: network,
      // The address is public anyway — customers are shown it — so it is
      // safe and useful to have in the trail.
      cryptoAddress: address,
    },
  });

  return getPaymentMethods();
}
