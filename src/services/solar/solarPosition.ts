/**
 * Solar Position Calculator
 *
 * Calculates the sun's azimuth (compass bearing) and altitude (angle above
 * the horizon) for any GPS location and point in time.
 *
 * Algorithm: Spencer (1971) / standard spherical astronomy formulas.
 * Accuracy: within ~1° of true position — sufficient for suitability assessment.
 */

import { SolarPosition } from '../../types/solar';

const TO_RAD = Math.PI / 180;
const TO_DEG = 180 / Math.PI;

/**
 * Returns the day of year (1–365) for a given Date object.
 */
function getDayOfYear(date: Date): number {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Calculates the solar declination angle in degrees for a given day of year.
 * Declination is the angle between the sun's rays and the equatorial plane.
 * Ranges from +23.45° (summer solstice) to -23.45° (winter solstice).
 */
function getSolarDeclination(dayOfYear: number): number {
  return 23.45 * Math.sin(TO_RAD * (360 / 365) * (dayOfYear - 81));
}

/**
 * Calculates the Equation of Time in minutes for a given day of year.
 * This corrects for the difference between clock time and true solar time,
 * caused by Earth's elliptical orbit and axial tilt.
 */
function getEquationOfTime(dayOfYear: number): number {
  // Angle in degrees representing the position in the year
  const B = TO_RAD * (360 / 365) * (dayOfYear - 81);
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

/**
 * Calculates the sun's position in the sky for a given location and UTC time.
 *
 * @param latitude  - GPS latitude in degrees (positive = north, negative = south)
 * @param longitude - GPS longitude in degrees (positive = east, negative = west)
 * @param date      - Date and time in UTC
 * @returns SolarPosition with azimuth (0=N, 90=E, 180=S, 270=W) and altitude in degrees
 */
export function getSolarPosition(
  latitude: number,
  longitude: number,
  date: Date
): SolarPosition {
  const dayOfYear = getDayOfYear(date);
  const declination = getSolarDeclination(dayOfYear);
  const equationOfTime = getEquationOfTime(dayOfYear);

  // Decimal UTC hours
  const utcHours =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600;

  // Local Solar Time (hours):
  //   - Longitude offset: 1 hour per 15° of longitude (positive = east = ahead)
  //   - Equation of Time: small correction for orbital mechanics (in minutes → convert to hours)
  const solarTime = utcHours + longitude / 15 + equationOfTime / 60;

  // Hour angle: 0 at solar noon, negative before noon (morning), positive after noon (afternoon)
  const hourAngle = 15 * (solarTime - 12); // degrees

  const latRad = latitude * TO_RAD;
  const decRad = declination * TO_RAD;
  const hourAngleRad = hourAngle * TO_RAD;

  // ── Solar altitude (elevation above horizon) ──────────────────────────────
  // From the spherical law of cosines for the astronomical triangle.
  const sinAltitude =
    Math.sin(latRad) * Math.sin(decRad) +
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(hourAngleRad);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAltitude))) * TO_DEG;

  // ── Solar azimuth (compass bearing from north, clockwise) ─────────────────
  // Derived from the same astronomical triangle.
  const cosAltitude = Math.cos(Math.asin(Math.max(-1, Math.min(1, sinAltitude))));
  const cosAzimuth =
    cosAltitude > 0.0001
      ? (Math.sin(decRad) - sinAltitude * Math.sin(latRad)) /
        (cosAltitude * Math.cos(latRad))
      : 0;

  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAzimuth))) * TO_DEG;

  // The formula above gives the azimuth measured from north toward south (0–180°).
  // If hour angle is positive (afternoon), the sun is in the west half, so mirror it.
  if (hourAngle > 0) {
    azimuth = 360 - azimuth;
  }

  return { azimuth, altitude };
}
