/**
 * Milestone 1 — Solar Position Module Test
 *
 * Demonstrates the solar position and suitability calculations for a
 * south-facing plug-in panel in London.
 *
 * Run with:  npm run test:solar
 */

import { getSolarPosition } from '../src/services/solar/solarPosition';
import {
  assessSuitability,
  getMonthlyDaylightPercentage,
} from '../src/services/solar/solarSuitability';

// ── Test location ──────────────────────────────────────────────────────────────
const LONDON_LAT = 51.5;  // 51.5°N
const LONDON_LON = -0.1;  // 0.1°W

const SOUTH = 180;  // panel facing due south
const NORTH = 0;    // panel facing due north (bad choice in northern hemisphere)
const EAST  = 90;   // panel facing east

// ── Separator helper ──────────────────────────────────────────────────────────
const line = () => console.log('─'.repeat(55));

console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║   SolarSnap — Solar Position Module Test             ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

// ── 1. Spot-check: Solar position at known times ───────────────────────────────
line();
console.log('1. Solar position at London solar noon\n');

// Summer solstice — sun should be due south, altitude ~62°
const juneSolsticeNoon = new Date('2025-06-21T11:58:00Z'); // ~solar noon at 0.1°W
const junePos = getSolarPosition(LONDON_LAT, LONDON_LON, juneSolsticeNoon);
console.log('June 21 (summer solstice) at solar noon:');
console.log(`  Azimuth:  ${junePos.azimuth.toFixed(1)}°  (expect ≈ 180° = due south)`);
console.log(`  Altitude: ${junePos.altitude.toFixed(1)}°  (expect ≈ 62° — high summer sun)`);

// Winter solstice — sun should still be due south but much lower, ~15°
const decSolsticeNoon = new Date('2025-12-21T11:58:00Z');
const decPos = getSolarPosition(LONDON_LAT, LONDON_LON, decSolsticeNoon);
console.log('\nDec 21 (winter solstice) at solar noon:');
console.log(`  Azimuth:  ${decPos.azimuth.toFixed(1)}°  (expect ≈ 180° = due south)`);
console.log(`  Altitude: ${decPos.altitude.toFixed(1)}°  (expect ≈ 15° — low winter sun)`);

// ── 2. Monthly comparison — showing seasonal variation ────────────────────────
line();
console.log('2. Monthly daylight-in-FOV % — south-facing panel, London\n');
console.log('   Month        | In FOV %  | Interpretation');
console.log('   -------------|-----------|--------------------------------');

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

for (let m = 0; m < 12; m++) {
  const pct = getMonthlyDaylightPercentage(LONDON_LAT, LONDON_LON, SOUTH, 2025, m);
  const bar = '█'.repeat(Math.round(pct / 5));
  const label = months[m].padEnd(12);
  console.log(`   ${label} |  ${pct.toFixed(1).padStart(5)}%  | ${bar}`);
}

// ── 3. Annual suitability assessment — south-facing ───────────────────────────
line();
console.log('3. Annual suitability assessment — south-facing panel\n');
console.log('   (This is the core metric the app will show users.)\n');
console.log('   Calculating... (samples 17,520 time points across the year)\n');

const southResult = assessSuitability(LONDON_LAT, LONDON_LON, SOUTH, juneSolsticeNoon);
console.log('   South-facing, London:');
console.log(`   Annual daylight in panel FOV: ${southResult.annualDaylightPercentage}%`);
console.log(`   Verdict: ${southResult.verdict}  ✓ (expected: Excellent)`);

// ── 4. Comparison: north-facing and east-facing ───────────────────────────────
line();
console.log('4. Comparison with other orientations\n');

const northResult = assessSuitability(LONDON_LAT, LONDON_LON, NORTH, juneSolsticeNoon);
console.log(`   North-facing: ${northResult.annualDaylightPercentage}% → ${northResult.verdict} (expected: Poor)`);

const eastResult = assessSuitability(LONDON_LAT, LONDON_LON, EAST, juneSolsticeNoon);
console.log(`   East-facing:  ${eastResult.annualDaylightPercentage}% → ${eastResult.verdict} (expected: Good — mornings only)`);

// ── 5. Current sun position check ─────────────────────────────────────────────
line();
console.log('5. Current solar position check (using test date)\n');
console.log(`   Sun azimuth:  ${southResult.currentSolarPosition.azimuth}°`);
console.log(`   Sun altitude: ${southResult.currentSolarPosition.altitude}°`);
console.log(`   Sun in panel FOV right now: ${southResult.isSunInView ? 'Yes' : 'No'}`);

line();
console.log('\n✓  All tests complete.\n');
