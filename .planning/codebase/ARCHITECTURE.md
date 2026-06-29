# Architecture

**Analysis Date:** 2026-06-30

## Pattern Overview

**Overall:** Plugin/Extension with pure-logic core and dependency injection

**Key Characteristics:**
- pi extension registering a single model provider via `pi.registerProvider()` at the entry point (`src/index.ts`)
- Three-file separation: wiring (`src/index.ts`), pure logic (`src/logic.ts`), OAuth flow (`src/oauth.ts`)
- All I/O in `src/logic.ts` parameterized through an options object (`readFile`, `fileExists`, `env`, `authPaths`, `homeDir`) so logic is fully unit-testable with no filesystem or network
- Streaming delegated entirely to pi's built-in `openai-completions` engine — no custom `streamSimple` protocol
- No build step: `tsconfig.json` has `noEmit: true` and pi loads `.ts` source directly (`package.json` → `pi.extensions`)

## Layers

**Extension Entry / Wiring:**
- Purpose: Receives pi's `ExtensionAPI`, resolves the API base, and registers the ClinePass provider with models, OAuth handlers, and the OpenAI-compatible API engine.
- Location: `src/index.ts`
- Contains: A single default-exported function calling `pi.registerProvider()`
- Depends on: `./logic.js` (`resolveApiBase`, `MODELS`, `PROVIDER_NAME`, `ENV_API_KEY`) and `./oauth.js` (`login`, `refreshToken`, `getApiKey`); type-only import of `ExtensionAPI` from `@earendil-works/pi-coding-agent`
- Used by: pi runtime, which loads the extension via `package.json` → `pi.extensions: ["./src/index.ts"]`

**Pure Logic:**
- Purpose: Holds model definitions, API-key resolution, API-base resolution, sanitization, and URL building — all side-effect-free and injectable.
- Location: `src/logic.ts`
- Contains: Constants (`DEFAULT_API_BASE`, `DEFAULT_ENDPOINT`, `ENV_API_KEY`, `PROVIDER_NAME`), `ModelConfig` interface, `MODELS` array (10 models), `modelIds()`, `defaultAuthPaths()`, `resolveApiKey()`, `resolveApiBase()`, `sanitizeApiKey()`, `buildEndpointUrl()`, type guards `isRecord`/`stringValue`
- Depends on: `node:fs` (`existsSync`, `readFileSync`), `node:os` (`homedir`), `node:path` (`join`) — but only as default fallbacks overridable via `AuthKeyOptions`
- Used by: `src/index.ts` and `src/oauth.ts` (imports `sanitizeApiKey`); exercised by `tests/unit/logic.test.ts`

**OAuth / Login Flow:**
- Purpose: Implements pi's `/login` lifecycle for ClinePass — browser-assisted key creation plus manual paste, stored as long-lived OAuth credentials.
- Location: `src/oauth.ts`
- Contains: `login()`, `refreshToken()`, `getApiKey()`, helper `credentialsFromApiKey()`; constants `DASHBOARD_URL`, `TEN_YEARS_MS`
- Depends on: `./logic.js` (`sanitizeApiKey`); type-only imports of `OAuthCredentials`, `OAuthLoginCallbacks` from `@earendil-works/pi-ai`
- Used by: `src/index.ts` wires these into the provider's `oauth` block

## Data Flow

**Provider Registration:**
1. pi loads the extension and calls the default export in `src/index.ts` with an `ExtensionAPI` instance.
2. `resolveApiBase()` reads `CLINE_API_BASE` (default `https://api.cline.bot`) to compute the base URL.
3. `pi.registerProvider(PROVIDER_NAME, {...})` registers `clinepass` with `baseUrl: ${apiBase}/api/v1`, `apiKey: $${ENV_API_KEY}` (resolves `CLINE_API_KEY`), `authHeader: true`, `api: "openai-completions"`, the `oauth` handlers from `src/oauth.ts`, and the `MODELS` mapped into pi's model shape.

**Model Request (runtime, handled by pi):**
1. User invokes a model as `clinepass/cline-pass/<slug>` (provider name `clinepass` + model id prefixed `cline-pass/`).
2. pi resolves the API key via the registered `apiKey` reference and/or the OAuth `getApiKey` callback.
3. pi's built-in `openai-completions` engine POSTs to `${apiBase}/api/v1/chat/completions` with `Authorization: Bearer <key>`, parsing SSE, tool calls, and usage internally — no custom streaming code in this extension.

**API Key Resolution (`resolveApiKey` in `src/logic.ts`):**
1. Return `providedKey` if supplied.
2. Return `env[CLINE_API_KEY]` if set.
3. For each path in `defaultAuthPaths(home)` (`~/.cline/data/settings/providers.json`, then `~/.pi/agent/auth.json`): parse JSON and, in order, try the Cline CLI nested key (`providers["cline-pass"|"cline"].settings.apiKey`, then `.settings.auth.accessToken`), then a top-level `apiKey` field, then a `clinepass` string field, then a `clinepass` OAuth object's `access` field.
4. Return `undefined` if nothing matches; malformed/unreadable files are silently skipped via try/catch.

**OAuth Login (`src/oauth.ts`):**
1. `login()` emits `onAuth({ url: DASHBOARD_URL })` to open the Cline API-keys dashboard.
2. Prompts the user via `onPrompt` to paste a key; the result is run through `sanitizeApiKey()`.
3. `credentialsFromApiKey()` returns `{ refresh: key, access: key, expires: now + 10 years }`; `refreshToken()` re-derives the same with a fresh 10-year expiry (a no-op since keys don't expire); `getApiKey()` returns `credentials.access`.

**State Management:**
- The extension is stateless after registration — all runtime state (credentials, streaming buffers, usage) lives in pi's runtime and pi's `~/.pi/agent/auth.json` store. `src/logic.ts` holds only immutable constant data (`MODELS`, defaults); `src/oauth.ts` derives credentials purely from inputs.
## Key Abstractions

**Model Definition:**
- Purpose: Describes a single ClinePass model (id, name, reasoning flag, input modalities, per-token cost, context window, max output tokens) for registration with pi.
- Examples: `src/logic.ts` (`ModelConfig` interface, `MODELS` array, `modelIds()`)
- Pattern: Readonly array of typed config records consumed by the mapper in `src/index.ts`

**Auth-Key Options (Dependency Injection seam):**
- Purpose: Decouples `resolveApiKey` from the real filesystem and `process.env` so logic can be tested with injected fakes.
- Examples: `src/logic.ts` (`AuthKeyOptions` interface, `defaultAuthPaths()`)
- Pattern: Options-object parameter with sensible Node.js defaults (`readFileSync`/`existsSync`/`homedir`/`process.env`) overridable per call

**OAuth Credentials Adapter:**
- Purpose: Bridges ClinePass's non-expiring static API keys into pi's OAuth credential model (`OAuthCredentials` with refresh/access/expires).
- Examples: `src/oauth.ts` (`credentialsFromApiKey`, `login`, `refreshToken`, `getApiKey`)
- Pattern: Adapter — maps a long-lived bearer token to pi's refresh-token contract with a far-future expiry

**Type Guards:**
- Purpose: Safely narrow untyped `JSON.parse` output from auth files.
- Examples: `src/logic.ts` (`isRecord`, `stringValue`)
- Pattern: Small pure predicates reused across the key-resolution chain

## Entry Points

**Extension default export:**
- Location: `src/index.ts`
- Triggers: pi runtime on extension load (via `package.json` → `pi.extensions`)
- Responsibilities: Resolve API base, register the `clinepass` provider with models, OAuth handlers, and the `openai-completions` API engine.

**`/login` flow:**
- Location: `src/oauth.ts` (`login`)
- Triggers: User runs `pi /login` and selects ClinePass
- Responsibilities: Open dashboard, prompt for paste, sanitize, and return 10-year OAuth credentials.

**E2E smoke harness:**
- Location: `tests/e2e/smoke.sh`
- Triggers: `npm run test:e2e` or CI `workflow_dispatch` with `run_e2e=true`
- Responsibilities: curl auth check, run `pi --no-extensions -e <provider> --model ...` against real models, and assert on error handling.

## Error Handling

**Strategy:** Defensive, fail-soft for credential discovery; explicit throw for user-facing auth actions; surface upstream API errors via pi's streaming engine.

**Patterns:**
- `resolveApiKey` (`src/logic.ts`) wraps each auth-file read in try/catch and `continue`s on malformed/unreadable files, returning `undefined` only when all sources are exhausted — so a missing/invalid file never breaks startup.
- `login` (`src/oauth.ts`) throws `Error("No ClinePass API key provided")` when the pasted value is empty after sanitization.
- `sanitizeApiKey` (`src/logic.ts`) strips bracketed-paste escape sequences (`ESC[200~`/`ESC[201~`) and control chars (< 32 or 127) so terminal paste artifacts can't corrupt the key.
- HTTP/401/403 and invalid-model errors are surfaced by pi/Cline's API and asserted by the error-handling section of `tests/e2e/smoke.sh` (grep for `error|401|403|unauthorized|invalid`).

## Cross-Cutting Concerns

**Logging:** None — the extension ships no logging library and relies on pi's runtime for user-facing output; logic functions return values rather than emitting logs.

**Validation:** Runtime type narrowing via `isRecord`/`stringValue` in `src/logic.ts`; `sanitizeApiKey` validates/cleans user input; `tests/unit/logic.test.ts` asserts model invariants (10 models, all `reasoning: true`, `input: ["text"]`, non-negative cost, positive context/maxTokens) and that all model IDs start with `cline-pass/`.

**Authentication:** Bearer-token auth via `authHeader: true` in `src/index.ts`; key resolved through the priority chain in `resolveApiKey` (provided → `CLINE_API_KEY` env → Cline CLI `providers.json` → pi `auth.json`); OAuth credentials minted with a 10-year expiry in `src/oauth.ts` because ClinePass API keys do not expire. Note (`src/logic.ts`/`README.md`) that the Cline CLI `accessToken` is a short-lived WorkOS token unsuitable for direct use — users should generate a static key from the dashboard.

---

*Architecture analysis: 2026-06-30*
