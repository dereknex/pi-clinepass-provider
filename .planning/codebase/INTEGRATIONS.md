# External Integrations

**Analysis Date:** 2026-06-30

## APIs & External Services

**LLM Inference (Cline / ClinePass):**
- ClinePass API — OpenAI-compatible Chat Completions, used to serve 10 curated open-weight coding models (GLM-5.2, Kimi K2.7/K2.6, DeepSeek V4 Pro/Flash, MiMo-V2.5/V2.5-Pro, MiniMax M3, Qwen3.7 Max/Plus). Endpoint: `https://api.cline.bot/api/v1/chat/completions` (default base `https://api.cline.bot`, defined in `src/logic.ts:26-27`; provider `baseUrl` set to `${apiBase}/api/v1` in `src/index.ts:40`).
- SDK/Client: None of its own. The extension registers `api: "openai-completions"` with pi (`src/index.ts:47`) and relies on pi's built-in `openai-completions` streaming to handle SSE parsing, tool calls, and usage tracking. Raw `curl` is used directly in the E2E harness (`tests/e2e/smoke.sh:71-75`).
- Auth: `CLINE_API_KEY` env var (preferred), resolved via the chain in `resolveApiKey` (`src/logic.ts:228`); sent as `Authorization: Bearer <key>` (`authHeader: true`, `src/index.ts:42`). Reference docs: `https://docs.cline.bot/getting-started/clinepass`.

**OAuth Login Flow (Cline Dashboard):**
- Cline API Keys dashboard `https://app.cline.bot/settings/api-keys` — opened in the browser during `pi /login` (`DASHBOARD_URL` in `src/oauth.ts:17`); user generates/copies a key and pastes it back. No programmatic OAuth token exchange is performed by this extension.

## Data Storage

**Databases:**
- None.

**File Storage:**
- Local filesystem only. The extension reads (never writes directly) auth credential files:
  - `~/.cline/data/settings/providers.json` — Cline CLI nested format (`providers["cline-pass"|"cline"].settings.apiKey` or `.settings.auth.accessToken`); handled in `resolveClineProvidersKey` (`src/logic.ts:192`).
  - `~/.pi/agent/auth.json` — pi OAuth format (`apiKey` field, or `clinepass` as string / `{type,access,refresh}` object); see `defaultAuthPaths` (`src/logic.ts:168`) and `resolveApiKey` (`src/logic.ts:228`).
- Writes to `~/.pi/agent/auth.json` are performed by the pi runtime (storing the `OAuthCredentials` returned from `src/oauth.ts`), not by this extension's own code.

**Caching:**
- None.

## Authentication & Identity

**Auth Provider:**
- Custom (Cline long-lived API keys / bearer tokens). ClinePass API keys do not expire, so the OAuth layer is a thin wrapper: `access == refresh == apiKey` with a 10-year far-future expiry (`TEN_YEARS_MS`, `credentialsFromApiKey` in `src/oauth.ts:18-26`).
- The Cline CLI's `auth.accessToken` (a short-lived WorkOS OAuth token) may be read as a fallback but is explicitly noted as unreliable/likely-expired for direct use (comment in `src/logic.ts:184-190`; README "Already signed in with the Cline CLI?" note).

**Implementation:**
- Login: browser-assisted + manual paste — `login()` in `src/oauth.ts:35` calls `callbacks.onAuth({ url })` then `callbacks.onPrompt(...)`; sanitizes input via `sanitizeApiKey` (`src/logic.ts:283`).
- Token refresh: no-op — `refreshToken()` in `src/oauth.ts:55` re-wraps the same key with a new far-future expiry.
- Key resolution priority: provided key → `CLINE_API_KEY` env → auth files in order (`src/logic.ts:228`).

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry/Datadog/etc. integrated).

**Logs:**
- None of its own. Relies on the pi runtime's logging/console output. Malformed/unreadable auth files are silently ignored (`catch {}` in `src/logic.ts:263`).

## CI/CD & Deployment

**Hosting:**
- N/A — not a hosted service. Published as a pi extension installed via `pi install git:github.com/jellydn/pi-clinepass-provider` (or local path / `pi -e`). npm package `pi-clinepass-provider@1.0.0` (`package.json`).

**CI Pipeline:**
- GitHub Actions (`.github/workflows/ci.yml`), single workflow `CI`:
  - **Unit Tests** job — runs on `push`/`PR` to `main` and on `workflow_dispatch`; `ubuntu-latest`, Node 22, `npm ci`, `npm test`.
  - **E2E Smoke Tests** job — runs only when `workflow_dispatch` input `run_e2e == 'true'`; installs `@earendil-works/pi-coding-agent` globally (`npm install -g`), then `bash tests/e2e/smoke.sh` with `CLINE_API_KEY` from repo secrets.

## Environment Configuration

**Required env vars:**
- `CLINE_API_KEY` — ClinePass bearer API key; required for live runtime use and for E2E tests (`tests/e2e/smoke.sh:27` exits with error if unset).

**Optional env vars:**
- `CLINE_API_BASE` — overrides the API endpoint (default `https://api.cline.bot`); read in `resolveApiBase` (`src/logic.ts:276`) and honored by the E2E script (`tests/e2e/smoke.sh:25`).

**Secrets location:**
- GitHub Actions repository secret `CLINE_API_KEY` (consumed in `.github/workflows/ci.yml:54`).
- Locally: shell env (`~/.zshrc` per README), or the auth files listed under Data Storage.

## Webhooks & Callbacks

**Incoming:**
- None.

**Outgoing:**
- None beyond: (1) outbound HTTP/SSE to the ClinePass Chat Completions endpoint, performed by pi's `openai-completions` streaming engine (not by this extension's code directly); (2) a browser-open to `https://app.cline.bot/settings/api-keys` during the `/login` flow (`src/oauth.ts:37`).

---

*Integration audit: 2026-06-30*
