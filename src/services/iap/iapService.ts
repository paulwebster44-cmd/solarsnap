/**
 * iapService.ts
 *
 * Wraps expo-in-app-purchases to provide a promise-based API that
 * the rest of the app can use without dealing with callback listeners directly.
 *
 * Key responsibilities:
 *   1. Connect to the App Store / Google Play on app startup
 *   2. Fetch live product metadata (price, title) so the UI never hardcodes prices
 *   3. Initiate a purchase and wait for the result (bridging the callback API to a Promise)
 *   4. After the store confirms a purchase, validate it server-side via the Supabase
 *      Edge Function before granting access — this prevents receipt forgery
 *   5. Acknowledge / finish the transaction ONLY after server validation succeeds
 *      (acknowledging before validation can let a refund slip through to a free upgrade)
 *   6. Restore previous purchases for users who reinstall the app
 */

import * as IAP from 'expo-in-app-purchases';
import { Platform } from 'react-native';
import { supabase } from '../auth/supabaseClient';
import type { LicenceTier } from '../auth/authService';

// ── Types ──────────────────────────────────────────────────────────────────────

export type PurchaseOutcome =
  | { success: true;  tier: LicenceTier }
  | { success: false; cancelled: true }
  | { success: false; cancelled: false; message: string };

export interface IAPProduct {
  productId: string;
  title: string;
  description: string;
  /** Localised price string from the store, e.g. "£2.99" */
  priceString: string;
}

// ── Module-level purchase resolver ────────────────────────────────────────────
//
// expo-in-app-purchases uses a single global listener for purchase events.
// When the user taps "Buy", we store a Promise resolver here; the listener
// resolves it once the purchase completes, fails, or is cancelled.
// Only one purchase can be in flight at a time so this is safe.

let pendingResolver: ((outcome: PurchaseOutcome) => void) | null = null;

// ── Store connection ───────────────────────────────────────────────────────────

/**
 * Connect to the native store and register the global purchase listener.
 * Call once on app startup (in App.tsx). Errors are non-fatal — the app
 * should still load even if the store is temporarily unreachable.
 */
export async function connectToStore(): Promise<void> {
  await IAP.connectAsync();

  IAP.setPurchaseListener(async ({ responseCode, results, errorCode }) => {
    if (!pendingResolver) return; // no active purchase flow

    // ── User cancelled ─────────────────────────────────────────────────────────
    if (responseCode === IAP.IAPResponseCode.USER_CANCELED) {
      pendingResolver({ success: false, cancelled: true });
      pendingResolver = null;
      return;
    }

    // ── Store or network error ─────────────────────────────────────────────────
    if (responseCode !== IAP.IAPResponseCode.OK || !results?.length) {
      const msg = errorCode
        ? `Store error (code ${errorCode})`
        : 'The purchase could not be completed. Please try again.';
      pendingResolver({ success: false, cancelled: false, message: msg });
      pendingResolver = null;
      return;
    }

    // ── Purchase received — validate server-side before acknowledging ──────────
    const purchase = results[0];
    try {
      const tier = await validateWithServer(purchase);

      // Acknowledge the transaction AFTER server validation.
      // Pass false for consumeItem — our products are non-consumable (one-time purchases)
      // so we acknowledge but do not consume. Consuming would remove the purchase from
      // the user's history and prevent it from being restored.
      await IAP.finishTransactionAsync(purchase, /* consumeItem */ false);

      pendingResolver({ success: true, tier });
    } catch (err) {
      // Do NOT finish the transaction if validation failed — the store will
      // surface it again on the next app launch so the user is not charged
      // without receiving their content.
      pendingResolver({
        success: false,
        cancelled: false,
        message: err instanceof Error ? err.message : 'Purchase validation failed. Please contact support.',
      });
    }

    pendingResolver = null;
  });
}

export async function disconnectFromStore(): Promise<void> {
  await IAP.disconnectAsync();
}

// ── Product metadata ───────────────────────────────────────────────────────────

/**
 * Fetches live product metadata from the store.
 * Always use this to display prices — never hardcode them.
 * Returns an empty array if the store is unavailable or the products aren't
 * registered yet (which is expected in development before store setup).
 */
export async function fetchProducts(productIds: string[]): Promise<IAPProduct[]> {
  try {
    const { responseCode, results } = await IAP.getProductsAsync(productIds);
    if (responseCode !== IAP.IAPResponseCode.OK || !results) return [];
    return results.map((p) => ({
      productId: p.productId,
      title: p.title,
      description: p.description,
      priceString: p.priceString,
    }));
  } catch {
    return [];
  }
}

// ── Purchase ───────────────────────────────────────────────────────────────────

/**
 * Initiates a purchase for the given product ID and waits for the outcome.
 *
 * Returns a typed PurchaseOutcome — the caller should not need to handle
 * raw IAP events. The purchase flow is:
 *   purchaseItemAsync → store shows payment sheet → listener fires →
 *   validateWithServer → finishTransactionAsync → resolve promise
 */
export async function purchaseProduct(productId: string): Promise<PurchaseOutcome> {
  return new Promise(async (resolve) => {
    pendingResolver = resolve;
    try {
      await IAP.purchaseItemAsync(productId);
    } catch (err) {
      // purchaseItemAsync throws synchronously for invalid product IDs or
      // when another purchase is already in progress
      pendingResolver = null;
      resolve({
        success: false,
        cancelled: false,
        message: err instanceof Error ? err.message : 'Could not initiate purchase.',
      });
    }
  });
}

// ── Restore purchases ──────────────────────────────────────────────────────────

/**
 * Restores previously purchased products.
 * Required by Apple App Store guidelines for non-subscription IAPs.
 *
 * For each restored purchase we re-validate server-side so Supabase is updated
 * even if the user switched devices or reinstalled the app.
 *
 * Returns the highest tier found, or null if nothing was restored.
 */
export async function restorePurchases(): Promise<LicenceTier | null> {
  const { responseCode, results } = await IAP.getPurchaseHistoryAsync();
  if (responseCode !== IAP.IAPResponseCode.OK || !results?.length) return null;

  let highestTier: LicenceTier | null = null;

  for (const purchase of results) {
    try {
      const tier = await validateWithServer(purchase);
      await IAP.finishTransactionAsync(purchase, false);
      // Keep the "highest" tier found: commercial > premium > basic > free
      highestTier = higherTier(highestTier, tier);
    } catch {
      // Validation failure for an individual historical purchase is non-fatal
    }
  }

  return highestTier;
}

// ── Server-side validation ─────────────────────────────────────────────────────

/**
 * Sends the raw purchase receipt to the Supabase Edge Function for verification.
 *
 * On iOS, expo-in-app-purchases provides a base64 receipt (transactionReceipt).
 * On Android, it provides a purchaseToken string.
 *
 * The Edge Function validates with Apple / Google, updates the Supabase profile,
 * and returns the new tier. We never trust the productId from the purchase object
 * alone — the server confirms it against the verified receipt.
 */
async function validateWithServer(purchase: IAP.InAppPurchase): Promise<LicenceTier> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in. Please log in and try again.');

  const body: Record<string, string> = {
    productId: purchase.productId,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  };

  if (Platform.OS === 'ios') {
    // transactionReceipt is a base64-encoded App Store receipt
    const receipt = (purchase as any).transactionReceipt as string | undefined;
    if (!receipt) throw new Error('No receipt data from App Store.');
    body.receipt = receipt;
  } else {
    // purchaseToken is the Google Play purchase token
    const token = (purchase as any).purchaseToken as string | undefined;
    if (!token) throw new Error('No purchase token from Google Play.');
    body.purchaseToken = token;
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('EXPO_PUBLIC_SUPABASE_URL not set');

  const response = await fetch(`${supabaseUrl}/functions/v1/validate-purchase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.message ?? `Validation failed (HTTP ${response.status})`);
  }

  return data.tier as LicenceTier;
}

// ── Tier comparison helper ─────────────────────────────────────────────────────

const TIER_RANK: Record<LicenceTier, number> = {
  free: 0, basic: 1, premium: 2, commercial: 3,
};

function higherTier(a: LicenceTier | null, b: LicenceTier): LicenceTier {
  if (a === null) return b;
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}
