/**
 * Obstruction Penalty Calculator
 *
 * Adjusts the solar suitability score downward based on how much of the
 * panel's sky view is blocked by obstructions.
 *
 * The 0.8 penalty factor reflects that solar panels still receive meaningful
 * diffuse (scattered) light even when direct sunlight is partially blocked —
 * typically around 15–20% of total irradiance on a clear day.
 */

import { SuitabilityVerdict } from '../../types/solar';

const PENALTY_FACTOR = 0.8;

/** Verdict thresholds — must match those in solarSuitability.ts */
function getVerdict(score: number): SuitabilityVerdict {
  if (score >= 65) return 'Excellent';
  if (score >= 50) return 'Good';
  if (score >= 30) return 'Fair';
  return 'Poor';
}

export interface AdjustedScore {
  /** Original score before obstruction penalty */
  baseScore: number;
  /** Score after applying the obstruction penalty */
  adjustedScore: number;
  /** Verdict based on the adjusted score */
  adjustedVerdict: SuitabilityVerdict;
  /** Fractional reduction applied (0 = no penalty, 1 = full blockage) */
  penaltyApplied: number;
}

/**
 * Calculates the obstruction-adjusted suitability score.
 *
 * @param baseScore      - Annual energy percentage from solarSuitability.ts
 * @param skyPercentage  - Centre-weighted sky coverage from analyseSkyPhoto()
 */
export function applyObstructionPenalty(
  baseScore: number,
  skyPercentage: number,
): AdjustedScore {
  // Fraction of the view that is obstructed (0.0 = clear, 1.0 = fully blocked)
  const obstructionFraction = Math.max(0, Math.min(1, (100 - skyPercentage) / 100));

  // Penalty: obstructions reduce the score, moderated by the diffuse-light factor
  const penaltyApplied = obstructionFraction * PENALTY_FACTOR;
  const rawAdjusted = baseScore * (1 - penaltyApplied);
  const adjustedScore = Math.round(rawAdjusted * 10) / 10;

  return {
    baseScore: Math.round(baseScore * 10) / 10,
    adjustedScore,
    adjustedVerdict: getVerdict(adjustedScore),
    penaltyApplied: Math.round(penaltyApplied * 100) / 100,
  };
}

/**
 * Averages two obstruction analyses (used when the user takes a second photo
 * after a borderline first result).
 */
export function averageSkyPercentages(first: number, second: number): number {
  return Math.round((first + second) / 2);
}
