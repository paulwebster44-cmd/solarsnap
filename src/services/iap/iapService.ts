/**
 * iapService.ts
 *
 * Wraps RevenueCat (react-native-purchases) to provide a promise-based IAP API.
 *
 * Key responsibilities:
 *   1. Configure RevenueCat on app startup with the user's Supabase ID as the
 *      app user ID — this ties purchases to accounts across devices/reinstalls
 *   2. Fetch live product metadata (price, title) from RevenueCat Offerings
 *   3. Initiate a purchase via RevenueCat — receipt validation is handled
 *      server-side by RevenueCat automatically; no separate Edge Function needed
 *   4. After a confirmed purchase, update the Supabase profile tier directly
 *   5. Restore previous purchases — RevenueCat re-validates and returns entitlements
 *
 * RevenueCat setup checklist (one-time, in the RevenueCat dashboard):
 *   1. Create a free account at https://app.revenuecat.com
 *   2. Add an app for iOS and Android
 *   3. Create Entitlements: 'basic' and 'premium'
 *   4. Create Products: 'solarsnap_basic' and 'solarsnap_premium'
 *   5. Attach products to entitlements
 *   6. Copy the public SDK keys to src/config/iapConfig.ts
 */

import Purchases, { CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';
import { supabase } from '../auth/supabaseClient';
import { updateLicenceTier } from '../auth/authService';
import type { LicenceTier } from '../auth/authService';
import { REVENUECAT_IOS_KEY, REVENUECAT_ANDROID_KEY, IAP_PRODUCTS } from '../../config/iapConfig';

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

// ── Store connection ───────────────────────────────────────────────────────────

/**
 * Configure RevenueCat on app startup.
 * Uses the Supabase user ID as the RevenueCat app user ID so purchases
 * are tied to the account and survive reinstalls / device switches.
 */
export async function connectToStore(): Promise<void> {
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
  const { data: { user } } = await supabase.auth.getUser();
  Purchases.configure({ apiKey, appUserID: user?.id });
}

/** No-op — RevenueCat does not require explicit disconnection. */
export async function disconnectFromStore(): Promise<void> {
  // RevenueCat manages its own lifecycle
}

// ── Product metadata ───────────────────────────────────────────────────────────

/**
 * Fetches live product metadata from RevenueCat Offerings.
 * Returns an empty array if offerings are unavailable or products aren't
 * configured yet in the RevenueCat dashboard.
 */
export async function fetchProducts(productIds: string[]): Promise<IAPProduct[]> {
  try {
    const offerings = await Purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    return packages
      .filter((pkg) => productIds.includes(pkg.product.identifier))
      .map((pkg) => ({
        productId: pkg.product.identifier,
        title: pkg.product.title,
        description: pkg.product.description,
        priceString: pkg.product.priceString,
      }));
  } catch {
    return [];
  }
}

// ── Purchase ───────────────────────────────────────────────────────────────────

/**
 * Initiates a purchase for the given product ID.
 *
 * RevenueCat validates the receipt with Apple/Google automatically.
 * On success we update the Supabase profile tier directly.
 */
export async function purchaseProduct(productId: string): Promise<PurchaseOutcome> {
  try {
    const offerings = await Purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    const pkg = packages.find((p) => p.product.identifier === productId);

    if (!pkg) {
      return {
        success: false,
        cancelled: false,
        message: 'Product not found. Please check your internet connection and try again.',
      };
    }

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const tier = tierFromCustomerInfo(customerInfo, productId);
    await updateLicenceTier(tier);
    return { success: true, tier };
  } catch (err: any) {
    if (err?.userCancelled) {
      return { success: false, cancelled: true };
    }
    return {
      success: false,
      cancelled: false,
      message: err?.message ?? 'The purchase could not be completed. Please try again.',
    };
  }
}

// ── Restore purchases ──────────────────────────────────────────────────────────

/**
 * Restores previously purchased products.
 * Required by Apple App Store guidelines for non-subscription IAPs.
 * Returns the highest tier found, or null if nothing was restored.
 */
export async function restorePurchases(): Promise<LicenceTier | null> {
  const customerInfo = await Purchases.restorePurchases();
  const active = customerInfo.entitlements.active;

  let tier: LicenceTier | null = null;
  if (active['premium']) tier = 'premium';
  else if (active['basic']) tier = 'basic';

  if (tier) {
    await updateLicenceTier(tier);
  }

  return tier;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Determines the licence tier from RevenueCat CustomerInfo.
 * Prefers entitlement-based detection; falls back to product ID matching.
 */
function tierFromCustomerInfo(customerInfo: CustomerInfo, productId: string): LicenceTier {
  const active = customerInfo.entitlements.active;
  if (active['premium']) return 'premium';
  if (active['basic']) return 'basic';
  // Fallback: infer from product ID if entitlements aren't configured yet
  if (productId === IAP_PRODUCTS.PREMIUM) return 'premium';
  if (productId === IAP_PRODUCTS.BASIC) return 'basic';
  return 'free';
}
