/**
 * iapConfig.ts
 *
 * In-app purchase product IDs and related constants.
 * Update these strings here — they are used both by the IAP service
 * and by the UpgradeSheet component; changing them in one place
 * updates the entire app.
 *
 * IMPORTANT: These exact strings must be registered in:
 *   - App Store Connect → My Apps → SolarSnap → In-App Purchases
 *   - Google Play Console → SolarSnap → Monetise → In-app products
 */

export const IAP_PRODUCTS = {
  /**
   * One-off purchase — unlocks the basic suitability verdict screen.
   * Non-consumable (purchased once, restored on reinstall).
   */
  BASIC: 'solarsnap_basic',

  /**
   * One-off purchase — unlocks the full PVGIS yield report.
   * Includes everything in BASIC plus annual kWh, savings, and monthly chart.
   * Non-consumable.
   */
  PREMIUM: 'solarsnap_premium',
} as const;

export type IAPProductId = (typeof IAP_PRODUCTS)[keyof typeof IAP_PRODUCTS];

/**
 * Contact address shown in the Commercial tier enquiry prompt.
 *
 * IMPORTANT — App Store compliance:
 *   Apple's guidelines prohibit directing users to an external URL to complete
 *   a purchase that bypasses IAP. The Commercial prompt must therefore be an
 *   enquiry / contact link only, not a purchase link. We open a pre-filled
 *   mailto: so the user can get in touch; no price or purchase language is used.
 */
export const COMMERCIAL_ENQUIRY_EMAIL = 'info@solarsnap.co.uk';

/** All product IDs as an array — passed to getProductsAsync() on startup. */
export const ALL_PRODUCT_IDS: string[] = Object.values(IAP_PRODUCTS);

/**
 * RevenueCat API keys — obtain from https://app.revenuecat.com
 * Create a free account, add your app, and copy the public SDK keys here.
 * These are safe to ship in the app bundle (they are public keys, not secret keys).
 */
export const REVENUECAT_IOS_KEY = 'REPLACE_WITH_REVENUECAT_IOS_KEY';
export const REVENUECAT_ANDROID_KEY = 'REPLACE_WITH_REVENUECAT_ANDROID_KEY';
