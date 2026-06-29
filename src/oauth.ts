/**
 * ClinePass login provider for pi's /login flow.
 *
 * ClinePass API keys are long-lived bearer tokens created from the Cline
 * dashboard (app.cline.bot → Settings → API Keys). Because they don't expire,
 * we implement a simple browser-assisted + manual-paste flow:
 *
 * 1. Open the Cline API Keys dashboard in the browser
 * 2. The user creates/copies a key and pastes it back into pi
 * 3. The key is stored in pi's auth.json as OAuth credentials with a
 *    far-future expiry
 */

import type { OAuthCredentials, OAuthLoginCallbacks } from "@earendil-works/pi-ai";
import { sanitizeApiKey } from "./logic.js";

const DASHBOARD_URL = "https://app.cline.bot/settings/api-keys";
const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000; // API keys don't expire

function credentialsFromApiKey(apiKey: string): OAuthCredentials {
  return {
    refresh: apiKey,
    access: apiKey,
    expires: Date.now() + TEN_YEARS_MS,
  };
}

/**
 * Start the ClinePass login flow.
 *
 * Opens the Cline API Keys dashboard so the user can generate a key, then
 * prompts them to paste it back. Returns OAuth credentials where
 * access == refresh == the API key (keys don't expire, so refresh is a no-op).
 */
export async function login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
  // Open the dashboard where the user can create an API key.
  callbacks.onAuth({ url: DASHBOARD_URL });

  const apiKey = sanitizeApiKey(
    await callbacks.onPrompt({
      message:
        "Paste your ClinePass API key (create one at the dashboard that just opened, under Settings → API Keys):",
    }),
  );

  if (!apiKey) throw new Error("No ClinePass API key provided");

  return credentialsFromApiKey(apiKey);
}

/**
 * ClinePass API keys don't expire, so "refresh" is a no-op.
 * Returns the same credentials with an updated far-future expiry.
 */
export async function refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
  return credentialsFromApiKey(credentials.refresh);
}

/**
 * Returns the access token (API key) from OAuth credentials.
 */
export function getApiKey(credentials: OAuthCredentials): string {
  return credentials.access;
}
