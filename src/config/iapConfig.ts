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
 * The Commercial licence is sold via the website to avoid Apple/Google
 * revenue share. This URL is shown in the upgrade prompt for commercial.
 */
export const COMMERCIAL_WEBSITE_URL = 'https://solarsnap.co.uk';

/** All product IDs as an array — passed to getProductsAsync() on startup. */
export const ALL_PRODUCT_IDS: string[] = Object.values(IAP_PRODUCTS);
