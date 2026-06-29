/**
 * Pure logic for ClinePass provider — testable without pi runtime.
 *
 * Handles model definitions, API key resolution, and environment helpers for
 * Cline's OpenAI-compatible API (https://api.cline.bot/api/v1/chat/completions).
 *
 * @module clinepass-logic
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ─── Type helpers ────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const DEFAULT_API_BASE = "https://api.cline.bot";
export const DEFAULT_ENDPOINT = "/api/v1/chat/completions";
export const ENV_API_KEY = "CLINE_API_KEY";

/**
 * The ClinePass provider name used in pi (pi registerProvider name).
 * Models are referenced as `clinepass/<model-slug>`.
 */
export const PROVIDER_NAME = "clinepass";

// ─── Model Definitions ─────────────────────────────────────────────────────

/**
 * ClinePass curated open-weight coding models.
 *
 * Model IDs use the full ClinePass slug (e.g. "cline-pass/glm-5.2") as
 * documented at https://docs.cline.bot/getting-started/clinepass — these are
 * the values Cline's API expects in the `model` field.
 *
 * `contextWindow` is in tokens; `maxTokens` is the max output tokens.
 * Reference pricing ($/M tokens) is from the ClinePass docs and is used for
 * usage tracking — ClinePass itself is a flat $9.99/mo subscription.
 */
export interface ModelConfig {
  id: string;
  name: string;
  reasoning: boolean;
  input: readonly ["text"];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow: number;
  maxTokens: number;
}

export const MODELS: readonly ModelConfig[] = [
  {
    id: "cline-pass/glm-5.2",
    name: "GLM-5.2 (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0 },
    contextWindow: 200_000,
    maxTokens: 131_072,
  },
  {
    id: "cline-pass/kimi-k2.7-code",
    name: "Kimi K2.7 Code (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 0.95, output: 4.0, cacheRead: 0.19, cacheWrite: 0 },
    contextWindow: 262_144,
    maxTokens: 131_072,
  },
  {
    id: "cline-pass/kimi-k2.6",
    name: "Kimi K2.6 (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 0.95, output: 4.0, cacheRead: 0.16, cacheWrite: 0 },
    contextWindow: 262_144,
    maxTokens: 131_072,
  },
  {
    id: "cline-pass/deepseek-v4-pro",
    name: "DeepSeek V4 Pro (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 1.74, output: 3.48, cacheRead: 0.0145, cacheWrite: 0 },
    contextWindow: 1_000_000,
    maxTokens: 384_000,
  },
  {
    id: "cline-pass/deepseek-v4-flash",
    name: "DeepSeek V4 Flash (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 0.14, output: 0.28, cacheRead: 0.0028, cacheWrite: 0 },
    contextWindow: 1_000_000,
    maxTokens: 384_000,
  },
  {
    id: "cline-pass/mimo-v2.5",
    name: "MiMo-V2.5 (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 0.14, output: 0.28, cacheRead: 0.0028, cacheWrite: 0 },
    contextWindow: 262_144,
    maxTokens: 131_072,
  },
  {
    id: "cline-pass/mimo-v2.5-pro",
    name: "MiMo-V2.5-Pro (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 1.74, output: 3.48, cacheRead: 0.0145, cacheWrite: 0 },
    contextWindow: 262_144,
    maxTokens: 131_072,
  },
  {
    id: "cline-pass/minimax-m3",
    name: "MiniMax M3 (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0 },
    contextWindow: 1_048_576,
    maxTokens: 131_072,
  },
  {
    id: "cline-pass/qwen3.7-max",
    name: "Qwen3.7 Max (ClinePass)",
    reasoning: true,
    input: ["text"],
    cost: { input: 2.5, output: 7.5, cacheRead: 0.5, cacheWrite: 3.125 },
    contextWindow: 262_144,
    maxTokens: 131_072,
  },
  {
    id: "cline-pass/qwen3.7-plus",
    name: "Qwen3.7 Plus (ClinePass)",
    reasoning: true,
    input: ["text"],
    // Qwen3.7 Plus has tiered pricing; we use the ≤256K rate as the default.
    cost: { input: 0.4, output: 1.6, cacheRead: 0.04, cacheWrite: 0.5 },
    contextWindow: 1_048_576,
    maxTokens: 131_072,
  },
];

/**
 * Return the model IDs registered for the ClinePass provider.
 */
export function modelIds(): string[] {
  return MODELS.map((m) => m.id);
}

// ─── API Key Resolution ──────────────────────────────────────────────────────

/**
 * Default auth file paths checked in order.
 *
 * 1. ~/.cline/data/settings/providers.json — Cline CLI credentials (nested)
 * 2. ~/.pi/agent/auth.json — pi's OAuth credentials store
 */
export function defaultAuthPaths(home: string): string[] {
  return [
    join(home, ".cline", "data", "settings", "providers.json"),
    join(home, ".pi", "agent", "auth.json"),
  ];
}

export interface AuthKeyOptions {
  env?: Record<string, string | undefined>;
  authPaths?: readonly string[];
  homeDir?: () => string;
  readFile?: (path: string) => string;
  fileExists?: (path: string) => boolean;
}

/**
 * Extract a ClinePass API key from the Cline CLI's nested providers.json
 * structure: providers["cline-pass"].settings.apiKey or
 * providers["cline-pass"].settings.auth.accessToken
 *
 * Note: the auth.accessToken from the Cline CLI is a short-lived WorkOS OAuth
 * token — it may be expired. Users should generate a static API key from
 * app.cline.bot → Settings → API Keys for reliable access.
 */
function resolveClineProvidersKey(parsed: Record<string, unknown>): string | undefined {
  const providers = isRecord(parsed.providers) ? parsed.providers : undefined;
  if (!providers) return undefined;

  // Check both "cline-pass" and "cline" provider entries
  for (const key of ["cline-pass", "cline"]) {
    const provider = isRecord(providers[key]) ? providers[key] : undefined;
    if (!provider) continue;
    const settings = isRecord(provider.settings) ? provider.settings : undefined;
    if (!settings) continue;

    // Static API key: settings.apiKey
    const apiKey = stringValue(settings.apiKey);
    if (apiKey) return apiKey;

    // OAuth token: settings.auth.accessToken
    const auth = isRecord(settings.auth) ? settings.auth : undefined;
    if (auth) {
      const accessToken = stringValue(auth.accessToken);
      if (accessToken) return accessToken;
    }
  }
  return undefined;
}

/**
 * Resolve the ClinePass API key.
 * Priority: provided key → CLINE_API_KEY env var → auth files
 *
 * Auth files checked:
 * - ~/.cline/data/settings/providers.json (Cline CLI nested format):
 *   {providers: {"cline-pass": {settings: {apiKey: "..."}}}}
 *   {providers: {"cline-pass": {settings: {auth: {accessToken: "..."}}}}}
 * - ~/.pi/agent/auth.json (pi OAuth format):
 *   {"clinepass": "..."} or {"clinepass": {"type":"oauth","access": "..."}}
 */
export function resolveApiKey(
  providedKey?: string,
  options: AuthKeyOptions = {},
): string | undefined {
  if (providedKey) return providedKey;

  const env = options.env ?? process.env;
  if (env[ENV_API_KEY]) return env[ENV_API_KEY];

  const home = options.homeDir?.() ?? homedir();
  const authPaths = options.authPaths ?? defaultAuthPaths(home);
  const readFile = options.readFile ?? ((p: string) => readFileSync(p, "utf-8"));
  const fileExists = options.fileExists ?? ((p: string) => existsSync(p));

  for (const authPath of authPaths) {
    try {
      if (!fileExists(authPath)) continue;
      const parsed: unknown = JSON.parse(readFile(authPath));
      if (!isRecord(parsed)) continue;

      // Cline CLI nested format: providers["cline-pass"].settings.apiKey or .auth.accessToken
      const clineKey = resolveClineProvidersKey(parsed);
      if (clineKey) return clineKey;

      // pi auth.json format: direct apiKey field
      const apiKey = stringValue(parsed.apiKey);
      if (apiKey) return apiKey;

      // pi auth.json format: clinepass field (string or OAuth object)
      const cpField = parsed.clinepass;
      if (typeof cpField === "string") return cpField;
      if (isRecord(cpField)) {
        const access = stringValue(cpField.access);
        if (access) return access;
      }
    } catch {
      // ignore malformed or unreadable auth files
    }
  }

  return undefined;
}

// ─── Environment Helpers ────────────────────────────────────────────────────

/**
 * Resolve the API base URL, allowing override via CLINE_API_BASE env var.
 */
export function resolveApiBase(env: Record<string, string | undefined> = process.env): string {
  return env.CLINE_API_BASE ?? DEFAULT_API_BASE;
}

/**
 * Remove terminal paste wrappers and control chars from API key input.
 */
export function sanitizeApiKey(input: string): string {
  const esc = String.fromCharCode(27);
  return Array.from(
    input
      .replaceAll(`${esc}[200~`, "")
      .replaceAll(`${esc}[201~`, "")
      .replaceAll("[200~", "")
      .replaceAll("[201~", ""),
  )
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("")
    .trim();
}

/**
 * Build the full chat completions endpoint URL from a base URL.
 *
 * Utility for documentation and tests — the actual extension uses pi's
 * built-in openai-completions streaming, which appends `/chat/completions`
 * to the provider's baseUrl (`${apiBase}/api/v1`) automatically.
 */
export function buildEndpointUrl(base: string): string {
  return `${base}${DEFAULT_ENDPOINT}`;
}
