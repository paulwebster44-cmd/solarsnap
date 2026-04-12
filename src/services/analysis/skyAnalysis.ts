/**
 * Sky Analysis Service
 *
 * Sends the sky photo to the Hugging Face Inference API for semantic
 * segmentation, then calculates what fraction of the panel's relevant
 * sky arc is clear versus obstructed.
 *
 * Model: nvidia/segformer-b2-finetuned-ade-512-512
 *   - Trained on ADE20K (150 semantic classes including sky, building, tree, etc.)
 *   - Returns labeled binary masks for each detected class
 *   - Free tier accessible via the HF Inference API
 *
 * The analysis uses centre-Gaussian weighting so pixels directly ahead of
 * the panel (image centre) count more than the peripheral edges, approximating
 * the portion of sky the sun actually travels through.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — expo-file-system/legacy has no separate type declarations
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { decodePNGMask, countMaskPixels } from './pngDecoder';

// ── Constants ─────────────────────────────────────────────────────────────────

const HF_MODEL = 'nvidia/segformer-b2-finetuned-ade-512-512';
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;

/**
 * Maximum image dimension sent to the API.
 * Segformer is trained at 512×512; larger images add latency without benefit.
 */
const MAX_IMAGE_PX = 512;

/** ADE20K labels that represent unobstructed sky. */
const SKY_LABELS = new Set(['sky']);

/**
 * ADE20K labels that represent obstructions relevant to solar panel siting.
 * These are the classes that can cast shadows or block the sun's path.
 */
const OBSTRUCTION_LABELS = new Set([
  'building', 'skyscraper', 'house', 'tower', 'hovel',
  'tree', 'palm', 'plant', 'vegetation', 'grass', 'bush',
  'wall', 'fence', 'railing',
  'pole', 'column', 'signboard',
  'chimney', 'antenna',
  'roof',
]);

// ── Types ─────────────────────────────────────────────────────────────────────

interface HFSegment {
  score: number;
  label: string;
  mask: string; // base64-encoded PNG
}

export interface ObstructionAnalysis {
  /** Centre-weighted percentage of the panel's sky arc that is clear. */
  skyPercentage: number;
  /** Centre-weighted percentage that is obstructed. */
  obstructionPercentage: number;
  /** Distinct obstruction labels detected in the image (e.g. ["tree", "building"]). */
  detectedObstructions: string[];
  /**
   * True when sky coverage is between 40–60% — the result is ambiguous enough
   * that a second photo from a slightly different angle may change the verdict.
   */
  isBorderline: boolean;
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Analyses a sky photo and returns the obstruction assessment.
 *
 * @param photoUri - Local file URI of the photo taken on the Assessment screen
 * @throws If the HF API is unavailable or returns an unexpected response
 */
export async function analyseSkyPhoto(photoUri: string): Promise<ObstructionAnalysis> {
  // ── Step 1: Resize image to max 512px (model's optimal input size) ─────────
  const resized = await ImageManipulator.manipulateAsync(
    photoUri,
    [{ resize: { width: MAX_IMAGE_PX } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );

  // ── Step 2: Read as base64 and send to HF Inference API ───────────────────
  const base64Image = await FileSystem.readAsStringAsync(resized.uri, {
    encoding: 'base64' as any,
  });

  const apiKey = process.env.EXPO_PUBLIC_HF_API_KEY;
  if (!apiKey || apiKey === 'your_huggingface_api_key_here') {
    throw new Error('No Hugging Face API key configured. Add EXPO_PUBLIC_HF_API_KEY to your .env file.');
  }

  const response = await fetch(HF_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    // HF image models require a data URI, not a raw base64 string
    body: JSON.stringify({ inputs: `data:image/jpeg;base64,${base64Image}` }),
  });

  // Handle model cold-start (503) — HF spins down free-tier models after idle
  if (response.status === 503) {
    let estimatedTime = 20;
    try {
      const body = await response.json();
      if (body.estimated_time) estimatedTime = Math.ceil(body.estimated_time);
    } catch { /* ignore parse errors */ }
    throw new HFModelLoadingError(estimatedTime);
  }

  if (!response.ok) {
    throw new Error(`Sky analysis failed — HF API returned ${response.status}`);
  }

  const segments: HFSegment[] = await response.json();

  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error('Unexpected response from sky analysis API.');
  }

  // ── Step 3: Decode masks and calculate centre-weighted sky coverage ─────────
  let weightedSky = 0;
  let weightedTotal = 0;
  const detectedObstructions: string[] = [];

  for (const segment of segments) {
    const label = segment.label.toLowerCase();

    try {
      const mask = decodePNGMask(segment.mask);
      const { weightedActive, weightedTotal: wt } = countMaskPixels(mask, true);

      // Use the first valid mask to set the total (all masks have the same dimensions)
      if (weightedTotal === 0) {
        weightedTotal = wt;
      }

      if (SKY_LABELS.has(label)) {
        weightedSky = weightedActive;
      } else if (OBSTRUCTION_LABELS.has(label)) {
        detectedObstructions.push(segment.label);
      }
    } catch {
      // Skip any mask that fails to decode; don't abort the whole analysis
    }
  }

  if (weightedTotal === 0) {
    throw new Error('Could not process any segmentation masks.');
  }

  const skyPercentage = Math.round((weightedSky / weightedTotal) * 100);
  const obstructionPercentage = 100 - skyPercentage;
  const isBorderline = skyPercentage >= 40 && skyPercentage <= 60;

  return {
    skyPercentage,
    obstructionPercentage,
    // Deduplicate labels and capitalise for display
    detectedObstructions: [...new Set(detectedObstructions)].map(
      (l) => l.charAt(0).toUpperCase() + l.slice(1),
    ),
    isBorderline,
  };
}

// ── Custom error for model cold-start ────────────────────────────────────────

/**
 * Thrown when the HF model is warming up (HTTP 503).
 * The caller can use `estimatedSeconds` to show a countdown to the user.
 */
export class HFModelLoadingError extends Error {
  constructor(public readonly estimatedSeconds: number) {
    super(`Model is warming up — ready in ~${estimatedSeconds}s`);
    this.name = 'HFModelLoadingError';
  }
}
