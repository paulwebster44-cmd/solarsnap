/**
 * Solar Suitability Assessment
 *
 * Determines how suitable a proposed panel location is by calculating
 * what percentage of annual daylight hours the sun falls within the
 * panel's effective field of view.
 */

import { SuitabilityResult, SuitabilityVerdict } from '../../types/solar';
import { getSolarPosition } from './solarPosition';

/** A plug-in panel can effectively capture sunlight within ±60° of its facing direction. */
const PANEL_FOV_DEG = 60;

/**
 * Calculates the shortest angular difference between two compass bearings.
 * Returns a value between 0 and 180°.
 */
function bearingDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Maps an annual daylight percentage to a suitability verdict.
 * Thresholds are based on typical plug-in solar performance expectations.
 */
function getVerdict(percentage: number): SuitabilityVerdict {
  if (percentage >= 65) return 'Excellent';
  if (percentage >= 50) return 'Good';
  if (percentage >= 30) return 'Fair';
  return 'Poor';
}

/**
 * Calculates what percentage of daylight hours over a given period the sun
 * is within the panel's effective field of view.
 *
 * Samples at 30-minute intervals — precise enough for suitability assessment
 * without being computationally expensive.
 *
 * @param latitude     - GPS latitude in degrees
 * @param longitude    - GPS longitude in degrees
 * @param panelBearing - Compass direction the panel faces (0=N, 90=E, 180=S, 270=W)
 * @param startDate    - Start of the period to assess (UTC)
 * @param endDate      - End of the period to assess (UTC)
 */
function calculateDaylightPercentage(
  latitude: number,
  longitude: number,
  panelBearing: number,
  startDate: Date,
  endDate: Date
): number {
  let totalDaylightSlots = 0;
  let inViewSlots = 0;

  const STEP_MS = 30 * 60 * 1000; // 30 minutes in milliseconds

  for (
    let t = startDate.getTime();
    t < endDate.getTime();
    t += STEP_MS
  ) {
    const date = new Date(t);
    const position = getSolarPosition(latitude, longitude, date);

    // Only count moments when the sun is above the horizon
    if (position.altitude > 0) {
      // Energy weight: sin(altitude) is a standard proxy for solar irradiance.
      // A sun at 60° altitude carries roughly 3× more usable energy than one at 15°
      // (shorter atmospheric path, higher beam intensity). This means a south-facing
      // panel scores well because the high-energy midday hours are always in its FOV,
      // even though it misses some low-energy early-morning/late-evening hours.
      const energyWeight = Math.sin(position.altitude * (Math.PI / 180));
      totalDaylightSlots += energyWeight;

      // Check if the sun's azimuth is within ±60° of the panel's facing direction
      if (bearingDifference(position.azimuth, panelBearing) <= PANEL_FOV_DEG) {
        inViewSlots += energyWeight;
      }
    }
  }

  if (totalDaylightSlots === 0) return 0;
  return (inViewSlots / totalDaylightSlots) * 100;
}

/**
 * Calculates the percentage of daylight hours in a specific calendar month
 * during which the sun is within the panel's field of view.
 * Useful for showing seasonal variation.
 */
export function getMonthlyDaylightPercentage(
  latitude: number,
  longitude: number,
  panelBearing: number,
  year: number,
  month: number // 0 = January, 11 = December
): number {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  const pct = calculateDaylightPercentage(latitude, longitude, panelBearing, start, end);
  return Math.round(pct * 10) / 10;
}

/**
 * Full annual suitability assessment for a proposed panel location.
 *
 * This is the main function called by the app. It calculates the annual
 * daylight percentage and returns a verdict, plus the current sun position.
 *
 * @param latitude       - GPS latitude in degrees (positive = north)
 * @param longitude      - GPS longitude in degrees (positive = east)
 * @param panelBearing   - Compass direction the panel faces (degrees from north)
 * @param assessmentDate - The date/time of the assessment (defaults to now)
 */
export function assessSuitability(
  latitude: number,
  longitude: number,
  panelBearing: number,
  assessmentDate: Date = new Date()
): SuitabilityResult {
  // Current sun position at the moment of assessment
  const currentPosition = getSolarPosition(latitude, longitude, assessmentDate);

  // Is the sun currently above the horizon and within the panel's field of view?
  const isSunInView =
    currentPosition.altitude > 0 &&
    bearingDifference(currentPosition.azimuth, panelBearing) <= PANEL_FOV_DEG;

  // Calculate over a full calendar year starting from 1 Jan of the assessment year
  const year = assessmentDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const annualPercentage = calculateDaylightPercentage(
    latitude,
    longitude,
    panelBearing,
    yearStart,
    yearEnd
  );

  return {
    annualDaylightPercentage: Math.round(annualPercentage * 10) / 10,
    verdict: getVerdict(annualPercentage),
    currentSolarPosition: {
      azimuth: Math.round(currentPosition.azimuth * 10) / 10,
      altitude: Math.round(currentPosition.altitude * 10) / 10,
    },
    isSunInView,
  };
}
