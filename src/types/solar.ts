/**
 * The sun's position in the sky at a given moment.
 */
export interface SolarPosition {
  /** Compass bearing of the sun: 0=North, 90=East, 180=South, 270=West */
  azimuth: number;
  /** Angle above the horizon in degrees. Negative means the sun is below the horizon. */
  altitude: number;
}

/**
 * The result of a full suitability assessment for a proposed panel location.
 */
export interface SuitabilityResult {
  /** Percentage of annual daylight hours during which the sun is within the panel's FOV */
  annualDaylightPercentage: number;
  /** Human-readable verdict derived from annualDaylightPercentage */
  verdict: SuitabilityVerdict;
  /** The sun's position at the moment the assessment was taken */
  currentSolarPosition: SolarPosition;
  /** Whether the sun is currently within the panel's effective field of view */
  isSunInView: boolean;
}

export type SuitabilityVerdict = 'Excellent' | 'Good' | 'Fair' | 'Poor';
