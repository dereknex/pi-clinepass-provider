# TESTING.md — Testing

## Framework

| Aspect      | Value                                                                      |
| ----------- | -------------------------------------------------------------------------- |
| Test runner | Vitest 4.x                                                                 |
| Config      | `vitest.config.ts` → includes `tests/**/*.test.ts`                         |
| Run command | `npm test` (or `npm run test:watch` for watch mode)                        |
| Test count  | 93 unit tests across 3 files                                               |
| E2E         | `tests/e2e/smoke.sh` (manual trigger, requires `CLINE_API_KEY` + `pi` CLI) |

## Test Structure

```
tests/
├── unit/
│   ├── logic.test.ts    # 50+ tests — resolveApiKey, resolveClineAuthCredentials, fetchRemoteModels, resolveModels, classifyClinePassError, sanitizeApiKey, isWorkosToken, constants
│   ├── oauth.test.ts    # 7 tests — refreshToken dispatch, WorkOS refresh, getApiKey
│   └── index.test.ts    # 12 tests — provider registration, model forwarding, oauth wiring, message_end error handler
└── e2e/
    └── smoke.sh         # API auth check, model smoke tests, error handling
```

## Mocking Strategy

### Dependency Injection (primary pattern)

All I/O is injected via options objects — no need to mock modules:

```typescript
// Test passes mock readFile and fileExists — no FS access
const readFile = () => JSON.stringify({ apiKey: "test_key" });
const fileExists = () => true;
expect(resolveApiKey(undefined, { readFile, fileExists })).toBe("test_key");
```

### Global fetch stubbing

For `fetchRemoteModels` and OAuth refresh tests:

```typescript
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 })));
});
afterEach(() => {
  vi.unstubAllGlobals();
});
```

### Console spy

For error/warning surface tests:

```typescript
const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
// ... trigger error ...
expect(errorSpy).toHaveBeenCalledTimes(1);
errorSpy.mockRestore();
```

### Fake ExtensionAPI

Tests use minimal fake objects with `as never` casts:

```typescript
const fakePi = {
  registerProvider(name: string, config: Record<string, unknown>) {
    captured = { name, config };
  },
  on(_event: string, _handler: unknown) {},
};
await mod.default(fakePi as never);
```

A shared `makeFakePi()` helper captures the `message_end` handler for error handler tests.

## Test Coverage by Module

### `src/logic.ts` (50+ tests)

| Function                      | Tests | Coverage                                                                                                                                                                 |
| ----------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `resolveApiKey`               | 17    | Priority order, env vars, auth files, Cline CLI nested format, WorkOS exclusion, malformed JSON, missing files                                                           |
| `resolveClineAuthCredentials` | 9     | cline-pass/cline providers, preference order, missing fields, malformed JSON, default expiresAt                                                                          |
| `fetchRemoteModels`           | 8     | No key, 404, network error, OpenAI format, bare array, non-cline-pass filtering, static fallback, empty list                                                             |
| `resolveModels`               | 3     | No key fallback, fetch fail fallback, remote success                                                                                                                     |
| `classifyClinePassError`      | 14    | 403, forbidden, subscription required, not subscribed, 401, unauthorized, invalid api key, 429, rate limit, too many requests, unknown, case-insensitivity, empty string |
| `sanitizeApiKey`              | 6     | Trim, paste wrappers, control chars, DEL, combined, whitespace-only                                                                                                      |
| `isWorkosToken`               | 4     | workos: prefix, static key, empty string, bare JWT                                                                                                                       |
| Constants                     | 4     | PROVIDER_NAME, ENV_API_KEY, DEFAULT_API_BASE, DEFAULT_ENDPOINT                                                                                                           |
| `resolveApiBase`              | 2     | Default, env override                                                                                                                                                    |
| `buildEndpointUrl`            | 2     | Default base, custom base                                                                                                                                                |
| `modelIds` / `MODELS`         | 3     | IDs, prefix check, field validation                                                                                                                                      |

### `src/oauth.ts` (7 tests)

| Function       | Tests                                                            | Coverage                                                                                        |
| -------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `refreshToken` | 5                                                                | Static key no-op, WorkOS fetch, workos: prefix preservation, non-OK error, missing tokens error |
| `getApiKey`    | 1                                                                | Returns access token                                                                            |
| `login`        | (indirectly tested via refreshToken/resolveClineAuthCredentials) |                                                                                                 |

### `src/index.ts` (12 tests)

| Area                  | Tests | Coverage                                                                                                                 |
| --------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------ |
| Provider registration | 3     | baseUrl, apiKey, api type, authHeader; static model fallback; oauth wiring                                               |
| message_end handler   | 9     | Registration, 403, 401, 429, unknown, provider fallback, other-provider ignore, non-error ignore, console.error fallback |

## E2E Smoke Tests

`tests/e2e/smoke.sh` runs real API calls against Cline's endpoint:

| Test                          | What it checks                              |
| ----------------------------- | ------------------------------------------- |
| API Auth Check                | HTTP status from `/api/v1/chat/completions` |
| DeepSeek V4 Flash (math)      | Simple arithmetic response                  |
| DeepSeek V4 Flash (knowledge) | Capital of Japan                            |
| MiMo V2.5 (math)              | Simple arithmetic                           |
| Kimi K2.6 (math)              | Simple arithmetic                           |
| Invalid API key               | Error message for bad credentials           |
| Invalid model ID              | Error message for nonexistent model         |

**Requirements:** `CLINE_API_KEY` env var, `pi` CLI installed globally.
**CI trigger:** `workflow_dispatch` with `run_e2e=true` (not on every push).

## CI Test Matrix

The CI workflow runs tests against two pi versions:

| Matrix variant  | Pi version                                   | Steps                                   |
| --------------- | -------------------------------------------- | --------------------------------------- |
| `latest`        | From lockfile (`npm ci`)                     | lint + typecheck + format:check + tests |
| `min-pi-0.80.2` | Pinned to 0.80.2 via `npm install --no-save` | typecheck + tests only                  |

`fail-fast: false` ensures both variants complete even if one fails.
