/**
 * validate-purchase — Supabase Edge Function (Deno)
 *
 * Validates an in-app purchase receipt server-side and, on success, promotes
 * the user's licence tier in the Supabase profiles table.
 *
 * Why server-side validation matters:
 *   Client-supplied purchase data can be forged. By verifying the receipt
 *   directly with Apple / Google from within this function — using secrets
 *   the client never sees — we ensure only genuine purchases unlock content.
 *
 * Required Supabase environment variables (set in Dashboard → Settings → Edge Functions):
 *   APPLE_SHARED_SECRET          — App-specific shared secret from App Store Connect
 *   GOOGLE_SERVICE_ACCOUNT_JSON  — Full JSON key file for a Google service account
 *                                   with the "Android Publisher" OAuth scope
 *   GOOGLE_PACKAGE_NAME          — Android application ID, e.g. "co.uk.solarsnap.app"
 *
 * Request body (JSON):
 *   platform     "ios" | "android"
 *   productId    "solarsnap_basic" | "solarsnap_premium"
 *   receipt      base64-encoded App Store receipt (iOS only)
 *   purchaseToken  Google Play purchase token (Android only)
 *
 * The caller must include a valid Supabase JWT in the Authorization header so
 * we can identify which user to upgrade — we never trust a userId from the body.
 *
 * Response (JSON):
 *   { success: true,  tier: "basic" | "premium" }
 *   { success: false, message: string }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

// ── CORS headers (required for fetch from React Native) ───────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Product ID → tier mapping ─────────────────────────────────────────────────

const PRODUCT_TIER: Record<string, 'basic' | 'premium'> = {
  solarsnap_basic:   'basic',
  solarsnap_premium: 'premium',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/**
 * Encodes a Uint8Array or string to URL-safe base64 (no padding).
 * Required for building a JWT — standard base64 uses + and / which are
 * not valid in JWT header/payload segments.
 */
function base64url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ── iOS validation ────────────────────────────────────────────────────────────

/**
 * Validates an App Store receipt with Apple's server.
 *
 * Apple's verifyReceipt endpoint first tries production; if it returns status 21007
 * the receipt is from the sandbox, so we retry against the sandbox URL. This covers
 * both real purchases and TestFlight / sandbox testing without any code changes.
 */
async function validateAppleReceipt(receipt: string, sharedSecret: string): Promise<boolean> {
  const body = JSON.stringify({
    'receipt-data': receipt,
    password: sharedSecret,
    'exclude-old-transactions': true,
  });

  // Try production first, then fall back to sandbox if Apple tells us it's a sandbox receipt
  for (const url of [
    'https://buy.itunes.apple.com/verifyReceipt',
    'https://sandbox.itunes.apple.com/verifyReceipt',
  ]) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = await res.json();

    if (data.status === 21007) continue; // sandbox receipt → retry with sandbox URL
    if (data.status !== 0) return false;  // any other non-zero status = invalid

    // status 0 means valid — check there is at least one in-app purchase in the receipt
    return Array.isArray(data.receipt?.in_app) && data.receipt.in_app.length > 0;
  }

  return false;
}

// ── Android validation ────────────────────────────────────────────────────────

/**
 * Obtains a short-lived OAuth2 access token from Google using a service account.
 *
 * We build a JWT signed with the service account's RSA private key, then exchange
 * it at Google's token endpoint. This avoids shipping any long-lived credential
 * to the client — the service account JSON lives only in Supabase env vars.
 */
async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);

  const header  = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss:  sa.client_email,
    sub:  sa.client_email,
    aud:  'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    iat:  now,
    exp:  now + 3600,
  }));

  const signingInput = `${header}.${payload}`;

  // Parse the PEM private key — strip header/footer and decode from base64
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\n/g, '');
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sigBytes  = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );
  const signature = base64url(new Uint8Array(sigBytes));
  const jwt = `${signingInput}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const { access_token } = await tokenRes.json();
  if (!access_token) throw new Error('Failed to obtain Google access token');
  return access_token;
}

/**
 * Validates a Google Play purchase token via the Play Developer API.
 *
 * purchaseState 0 = purchased, 1 = cancelled, 2 = pending.
 * We only accept state 0.
 */
async function validateGooglePurchase(
  packageName: string,
  productId: string,
  purchaseToken: string,
  serviceAccountJson: string,
): Promise<boolean> {
  const accessToken = await getGoogleAccessToken(serviceAccountJson);

  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return false;

  const data = await res.json();
  // purchaseState 0 = purchased (not cancelled or pending)
  return data.purchaseState === 0;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Handle CORS pre-flight from mobile clients
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  // ── 1. Parse and validate request body ──────────────────────────────────────

  let platform: string, productId: string, receipt: string | undefined, purchaseToken: string | undefined;
  try {
    ({ platform, productId, receipt, purchaseToken } = await req.json());
  } catch {
    return json({ success: false, message: 'Invalid request body' }, 400);
  }

  if (!platform || !productId) {
    return json({ success: false, message: 'Missing required fields: platform, productId' }, 400);
  }

  const tier = PRODUCT_TIER[productId];
  if (!tier) {
    return json({ success: false, message: `Unknown product: ${productId}` }, 400);
  }

  // ── 2. Identify the user from the JWT in the Authorization header ────────────
  // We use the anon key client to verify the JWT; the service role client is used
  // only for the DB write so it bypasses RLS on the profiles table.

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ success: false, message: 'Missing Authorization header' }, 401);
  }

  const supabaseUrl         = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey     = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await anonClient.auth.getUser();
  if (authError || !user) {
    return json({ success: false, message: 'Unauthorised' }, 401);
  }

  // ── 3. Validate receipt with the appropriate store ───────────────────────────

  try {
    let valid = false;

    if (platform === 'ios') {
      const appleSharedSecret = Deno.env.get('APPLE_SHARED_SECRET');
      if (!appleSharedSecret) throw new Error('APPLE_SHARED_SECRET env var not set');
      if (!receipt) return json({ success: false, message: 'Missing receipt for iOS' }, 400);
      valid = await validateAppleReceipt(receipt, appleSharedSecret);

    } else if (platform === 'android') {
      const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
      const packageName        = Deno.env.get('GOOGLE_PACKAGE_NAME');
      if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var not set');
      if (!packageName)        throw new Error('GOOGLE_PACKAGE_NAME env var not set');
      if (!purchaseToken) return json({ success: false, message: 'Missing purchaseToken for Android' }, 400);
      valid = await validateGooglePurchase(packageName, productId, purchaseToken, serviceAccountJson);

    } else {
      return json({ success: false, message: `Unknown platform: ${platform}` }, 400);
    }

    if (!valid) {
      // Log for debugging without exposing details to the client
      console.error(`Receipt validation failed — user ${user.id}, product ${productId}, platform ${platform}`);
      return json({ success: false, message: 'Receipt validation failed. Please contact support if you believe this is an error.' }, 402);
    }

  } catch (err) {
    console.error('Validation error:', err);
    return json({ success: false, message: 'Receipt validation error. Please try again.' }, 500);
  }

  // ── 4. Update the user's tier in Supabase (service role bypasses RLS) ────────

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
  const { error: updateError } = await serviceClient
    .from('profiles')
    .update({ licence_tier: tier, tier_purchased_at: new Date().toISOString() })
    .eq('id', user.id);

  if (updateError) {
    console.error('Profile update failed:', updateError);
    return json({ success: false, message: 'Purchase verified but account update failed. Please contact support.' }, 500);
  }

  return json({ success: true, tier });
});
