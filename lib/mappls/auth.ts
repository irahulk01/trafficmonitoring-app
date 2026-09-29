/**
 * lib/mappls/auth.ts
 *
 * Manages Mappls OAuth 2.0 access tokens using the client_credentials flow.
 * Tokens are cached in memory and refreshed automatically 60 s before they
 * expire, so the polling loop never hits the token endpoint on every cycle.
 *
 * Required env vars:
 *   MAPPLS_CLIENT_ID      – from https://apis.mappls.com/console
 *   MAPPLS_CLIENT_SECRET  – from https://apis.mappls.com/console
 */

import { MapplsTokenResponse } from './types';

// ─── In-memory token cache ────────────────────────────────────────────────────

interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let _cache: TokenCache | null = null;
/** In-flight fetch promise — shared across all concurrent callers during the first cycle */
let _inflightFetch: Promise<TokenCache> | null = null;

const TOKEN_ENDPOINT =
  'https://outpost.mappls.com/api/security/oauth/token';

/** How many ms before actual expiry to treat the token as stale */
const EXPIRY_BUFFER_MS = 60_000;

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Returns the configured Mappls client credentials from env.
 * Throws clearly if they are missing.
 */
export function getMapplsCredentials(): {
  clientId: string;
  clientSecret: string;
  restApiKey: string;
  isConfigured: boolean;
} {
  const clientId = process.env.MAPPLS_CLIENT_ID || '';
  const clientSecret = process.env.MAPPLS_CLIENT_SECRET || '';
  const restApiKey = process.env.MAPPLS_REST_API_KEY || '';

  const isConfigured = Boolean(clientId && clientSecret && restApiKey);

  if (!isConfigured) {
    console.warn(
      '⚠️ [Mappls Auth] Missing one or more env vars: ' +
        'MAPPLS_CLIENT_ID, MAPPLS_CLIENT_SECRET, MAPPLS_REST_API_KEY'
    );
  }

  return { clientId, clientSecret, restApiKey, isConfigured };
}

/**
 * Fetches a fresh OAuth access token from the Mappls token endpoint.
 */
async function fetchToken(
  clientId: string,
  clientSecret: string
): Promise<TokenCache> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
    // Node 18+ native fetch; cache: 'no-store' prevents stale responses
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `[Mappls Auth] Token endpoint returned ${res.status}: ${text}`
    );
  }

  const data: MapplsTokenResponse = await res.json();

  if (!data.access_token) {
    throw new Error('[Mappls Auth] Token response missing access_token field');
  }

  const expiresAt =
    Date.now() + (data.expires_in ?? 86400) * 1000 - EXPIRY_BUFFER_MS;

  console.log(
    `🔑 [Mappls Auth] New access token acquired, valid for ${Math.round(
      (data.expires_in ?? 86400) / 60
    )} min`
  );

  return { accessToken: data.access_token, expiresAt };
}

/**
 * Returns a valid Mappls access token, refreshing from the API if necessary.
 */
export async function getAccessToken(): Promise<string> {
  const { clientId, clientSecret } = getMapplsCredentials();

  // Return cached token if still valid
  if (_cache && Date.now() < _cache.expiresAt) {
    return _cache.accessToken;
  }

  // If a fetch is already in-flight (e.g. 21 parallel segment calls on startup),
  // reuse the same promise instead of each caller hitting the token endpoint.
  if (!_inflightFetch) {
    _inflightFetch = fetchToken(clientId, clientSecret).finally(() => {
      _inflightFetch = null;
    });
  }

  _cache = await _inflightFetch;
  return _cache.accessToken;
}
