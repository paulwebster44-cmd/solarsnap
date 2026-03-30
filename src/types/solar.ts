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
  /** Percentage of annual solar energy potential captured within the panel's FOV.
   *  Weighted by sin(altitude) so high-energy midday hours count more than low-energy
   *  morning/evening hours. More physically meaningful than a raw hour count. */
  annualDaylightPercentage: number;
  /** Human-readable verdict derived from annualDaylightPercentage */
  verdict: SuitabilityVerdict;
  /** The sun's position at the moment the assessment was taken */
  currentSolarPosition: SolarPosition;
  /** Whether the sun is currently within the panel's effective field of view */
  isSunInView: boolean;
}

/** Verdict thresholds (energy-weighted % of annual solar potential):
 *  Excellent ≥65% | Good ≥50% | Fair ≥30% | Poor <30% */
export type SuitabilityVerdict = 'Excellent' | 'Good' | 'Fair' | 'Poor';

/**
 * Result of the sky photo obstruction analysis (Milestone 3).
 */
export interface ObstructionAnalysis {
  /** Centre-weighted % of the panel's sky arc that is unobstructed */
  skyPercentage: number;
  /** Centre-weighted % that is obstructed */
  obstructionPercentage: number;
  /** Obstruction labels detected (e.g. ["Tree", "Building"]) */
  detectedObstructions: string[];
  /** True if sky coverage 40–60% — a second photo is recommended */
  isBorderline: boolean;
}

/**
 * The final combined result after applying the obstruction penalty.
 */
export interface FinalAssessment {
  solarResult: SuitabilityResult;
  obstruction: ObstructionAnalysis;
  /** Suitability score after obstruction penalty */
  adjustedScore: number;
  /** Verdict based on the adjusted score */
  adjustedVerdict: SuitabilityVerdict;
}
