/**
 * energyConfig.ts
 *
 * Central configuration for energy yield calculations.
 * Update DEFAULT_UNIT_PRICE_GBP when UK electricity prices change —
 * it is the only value that needs periodic maintenance.
 */

export const ENERGY_CONFIG = {
  /**
   * Default panel capacity in Watts-peak.
   * 400 Wp is a typical single plug-in solar panel (also sold as "balcony solar").
   */
  defaultCapacityWp: 400,

  /**
   * Default panel tilt in degrees from horizontal.
   * 90° = vertical (wall-mounted), which is standard for plug-in panels
   * mounted on a balcony railing or wall bracket.
   */
  defaultTiltDeg: 90,

  /**
   * System loss factor as a percentage.
   * 14% is the PVGIS default and covers wiring losses, temperature
   * de-rating, dust, and inverter inefficiency for a typical installation.
   */
  defaultLossPercent: 14,

  /**
   * Default electricity unit price in GBP per kWh.
   * Based on the UK Ofgem price cap average (April 2024 rate).
   * Update this when the price cap changes; it does not affect
   * the kWh yield calculation, only the £ saving estimate.
   */
  defaultUnitPriceGBP: 0.245,

  /**
   * Min/max bounds for user-adjustable capacity input (Wp).
   */
  minCapacityWp: 100,
  maxCapacityWp: 800,

  /**
   * Min/max bounds for user-adjustable unit price input (£/kWh).
   */
  minUnitPriceGBP: 0.10,
  maxUnitPriceGBP: 0.60,
} as const;
