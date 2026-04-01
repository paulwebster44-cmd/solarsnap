/**
 * pvgisService.ts
 *
 * Calls the PVGIS (Photovoltaic Geographical Information System) API
 * provided by the EU Joint Research Centre to estimate annual and monthly
 * energy yield for a given location and panel orientation.
 *
 * API docs:
 * https://joint-research-centre.ec.europa.eu/pvgis-photovoltaic-geographical-information-system/getting-started-pvgis/api-non-interactive-service_en
 *
 * Endpoint used: /PVcalc
 * Returns hourly/monthly/annual energy output for a fixed-mount PV system.
 */

import { ENERGY_CONFIG } from '../../config/energyConfig';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PVGISParams {
  latitude: number;
  longitude: number;
  /** Compass bearing in degrees (0 = North, 90 = East, 180 = South, 270 = West). */
  bearing: number;
  /** Panel tilt in degrees from horizontal (0 = flat, 90 = vertical wall-mount). */
  tiltDeg?: number;
  /** Peak system capacity in Watts-peak (e.g. 400 for a single plug-in panel). */
  capacityWp?: number;
  /** System loss percentage (default 14). */
  lossPercent?: number;
  /** Electricity unit price in £/kWh used to calculate the £ saving. */
  unitPriceGBP?: number;
}

export interface PVGISMonthlyEntry {
  month: number;        // 1–12
  energyKWh: number;   // Estimated energy output for that month (kWh)
}

export interface PVGISResult {
  /** Estimated total energy output over a year (kWh). */
  annualKWh: number;
  /** Estimated annual saving in GBP at the given unit price. */
  annualSavingGBP: number;
  /** Per-month energy breakdown (12 entries, January–December). */
  monthly: PVGISMonthlyEntry[];
  /** Unit price used for the saving calculation (£/kWh). */
  unitPriceGBP: number;
  /** Panel capacity used for this calculation (Wp). */
  capacityWp: number;
  /** Raw JSON response from PVGIS, retained for debugging. */
  rawResponse: unknown;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PVGIS_BASE_URL = 'https://re.jrc.ec.europa.eu/api/v5_2/PVcalc';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Converts a compass bearing (0–360°, 0 = North) to the PVGIS "aspect" convention
 * (−180 to 180°, 0 = South, −90 = East, 90 = West, ±180 = North).
 *
 * PVGIS measures azimuth deviation from south because south-facing panels are
 * the reference optimum in the northern hemisphere.
 */
function bearingToPVGISAspect(bearing: number): number {
  let aspect = bearing - 180;
  // Normalise to the −180..180 range
  if (aspect > 180) aspect -= 360;
  if (aspect < -180) aspect += 360;
  return Math.round(aspect);
}

// ── Main function ──────────────────────────────────────────────────────────────

/**
 * Fetches an annual/monthly PV yield estimate from the PVGIS API.
 *
 * @throws {PVGISCoverageError} when PVGIS has no data for the location
 * @throws {Error} for network failures or unexpected API responses
 */
export async function fetchPVGISYield(params: PVGISParams): Promise<PVGISResult> {
  const capacityWp  = params.capacityWp  ?? ENERGY_CONFIG.defaultCapacityWp;
  const tiltDeg     = params.tiltDeg     ?? ENERGY_CONFIG.defaultTiltDeg;
  const lossPercent = params.lossPercent ?? ENERGY_CONFIG.defaultLossPercent;
  const unitPrice   = params.unitPriceGBP ?? ENERGY_CONFIG.defaultUnitPriceGBP;

  // PVGIS peakpower is in kWp, not Wp
  const peakPowerKWp = capacityWp / 1000;

  const aspect = bearingToPVGISAspect(params.bearing);

  const url = new URL(PVGIS_BASE_URL);
  url.searchParams.set('lat',           params.latitude.toFixed(5));
  url.searchParams.set('lon',           params.longitude.toFixed(5));
  url.searchParams.set('peakpower',     peakPowerKWp.toFixed(3));
  url.searchParams.set('loss',          lossPercent.toString());
  url.searchParams.set('angle',         tiltDeg.toString());
  url.searchParams.set('aspect',        aspect.toString());
  url.searchParams.set('outputformat',  'json');
  url.searchParams.set('pvtechchoice',  'crystSi');   // crystalline silicon — most common panel type
  url.searchParams.set('mountingplace', 'building');  // building-integrated / wall-mounted
  url.searchParams.set('browser',       '0');         // machine client, not browser

  const response = await fetch(url.toString());

  if (!response.ok) {
    // PVGIS returns 400 with a JSON error body when the location is outside
    // its coverage area (e.g. ocean, polar regions) or parameters are invalid.
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body?.message) detail = body.message;
      else if (body?.error?.message) detail = body.error.message;
    } catch { /* ignore parse failure */ }
    throw new PVGISCoverageError(detail);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await response.json();

  // Validate that the expected output shape is present
  const annualKWh: number | undefined = data?.outputs?.totals?.fixed?.E_y;
  const monthlyRaw: unknown[] | undefined = data?.outputs?.monthly?.fixed;

  if (typeof annualKWh !== 'number' || !Array.isArray(monthlyRaw)) {
    throw new Error('Unexpected response structure from PVGIS API.');
  }

  // Parse monthly entries — PVGIS returns E_m (average monthly kWh)
  const monthly: PVGISMonthlyEntry[] = monthlyRaw.map((entry: any) => ({
    month: entry.month as number,
    energyKWh: Math.round(entry.E_m as number),
  }));

  // Annual saving = annual kWh × unit price
  const annualSavingGBP = parseFloat((annualKWh * unitPrice).toFixed(2));

  return {
    annualKWh: Math.round(annualKWh),
    annualSavingGBP,
    monthly,
    unitPriceGBP: unitPrice,
    capacityWp,
    rawResponse: data,
  };
}

// ── Custom error ───────────────────────────────────────────────────────────────

/**
 * Thrown when PVGIS cannot provide data for the requested location or parameters.
 * The message contains the detail returned by the API.
 */
export class PVGISCoverageError extends Error {
  constructor(detail: string) {
    super(`PVGIS coverage error: ${detail}`);
    this.name = 'PVGISCoverageError';
  }
}
