import { UserProfile } from './authService';

/** Haversine formula — returns distance in metres between two lat/lon points. */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type BoundaryResult =
  | { allowed: true }
  | { allowed: false; distance: number };

/** Returns whether the user's current position is within the allowed assessment boundary. */
export function checkBoundary(
  userLat: number,
  userLon: number,
  profile: UserProfile,
): BoundaryResult {
  // Commercial licence has no boundary restriction
  if (profile.licence_tier === 'commercial') return { allowed: true };
  if (profile.home_latitude == null || profile.home_longitude == null) return { allowed: true };

  const distance = haversineDistance(userLat, userLon, profile.home_latitude, profile.home_longitude);
  if (distance <= 200) return { allowed: true };
  return { allowed: false, distance: Math.round(distance) };
}

/**
 * Returns whether the user may run another assessment.
 *
 * Commercial licence has unlimited assessments.
 * All other tiers (free, basic, premium) share a credit allowance — Basic and
 * Premium users receive 10 credits on sign-up/purchase; free/anonymous users
 * receive a smaller trial allowance set in Supabase.
 */
export function hasCredits(profile: UserProfile): boolean {
  if (profile.licence_tier === 'commercial') return true;
  return profile.credits_remaining > 0;
}

/** Returns true if the user has the Premium tier or a Commercial licence (yield report access). */
export function hasPremiumTier(profile: UserProfile): boolean {
  return profile.licence_tier === 'premium' || profile.licence_tier === 'commercial';
}
