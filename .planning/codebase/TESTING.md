# Testing Patterns

**Analysis Date:** 2026-06-30

## Test Framework

**Runner:**
- Vitest ^4.1.5
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in `expect` (imported from `vitest` alongside `describe`/`it`)

**Run Commands:**
```bash
npm test              # Run all unit tests (vitest run)
npm run test:watch    # Watch mode (vitest)
npm run test:e2e      # E2E smoke tests (bash tests/e2e/smoke.sh)
npm run typecheck     # TypeScript type checking (tsc)
```

## Test File Organization

**Location:**
- Separate `tests/` directory (not co-located with sources). Unit tests in `tests/unit/`, E2E in `tests/e2e/`.

**Naming:**
- Unit: `<module>.test.ts` matching the source module (e.g., `logic.test.ts` ↔ `src/logic.ts`).
- E2E: `smoke.sh`.

**Structure:**
```
tests/
  unit/
    logic.test.ts
  e2e/
    smoke.sh
```
`vitest.config.ts` globs `tests/**/*.test.ts`, so only `*.test.ts` files run under Vitest.

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from "vitest";
import { resolveApiKey, /* ... */ } from "../../src/logic.js";

// ─── resolveApiKey ──────────────────────────────────────────────────────────

describe("resolveApiKey", () => {
  it("returns provided key first", () => {
    expect(resolveApiKey("cline_provided")).toBe("cline_provided");
  });

  it("falls back to env var", () => {
    expect(resolveApiKey(undefined, { env: { CLINE_API_KEY: "cline_env" } })).toBe("cline_env");
  });
});
```
(`tests/unit/logic.test.ts:1-25`) — one `describe` per exported function/subject, separated by box-drawing dividers mirroring `src/logic.ts`; `it("describes behavior in plain English")`.

**Patterns:**
- Setup: inline mock functions defined within each `it` (no shared `beforeEach`).
- Teardown: none — no global state; dependency injection keeps tests isolated.
- Assertion: `toBe`, `toBeUndefined`, `toHaveLength`, `toContain`, `toEqual`, `toBeGreaterThan`, `toBeGreaterThanOrEqual`, plus `.startsWith()` on the value itself (`tests/unit/logic.test.ts:143`).

## Mocking

**Framework:** Vitest's `vi` is NOT used. Mocking is done via **dependency injection** through the `AuthKeyOptions` parameter on `resolveApiKey` (no `vi.mock()`, no module mocks).

**Patterns:**
```typescript
it("falls back to auth.json with apiKey field", () => {
  const readFile = () => JSON.stringify({ apiKey: "cline_from_file" });
  const fileExists = () => true;
  expect(resolveApiKey(undefined, { readFile, fileExists })).toBe("cline_from_file");
});
```
(`tests/unit/logic.test.ts:27-31`) — hand-rolled function stubs injected as options.

Path-sensitive stubs simulate multiple auth files:
```typescript
const readFile = (p: string) => {
  if (p.includes("providers.json")) throw new Error("ENOENT");
  return JSON.stringify({ apiKey: "cline_from_pi_auth" });
};
const fileExists = (p: string) => !p.includes("providers.json");
```
(`tests/unit/logic.test.ts:91-95`)

**What to Mock:**
- `readFile`, `fileExists` (injectable via `AuthKeyOptions`) — per `AGENTS.md`, unit tests use dependency injection and touch no FS or network.
- `env` (injected via `AuthKeyOptions.env`) to test `CLINE_API_KEY` resolution deterministically.
- `authPaths` and `homeDir` to avoid depending on the real home directory.

**What NOT to Mock:**
- The pi runtime / `ExtensionAPI` (not unit-tested).
- Network or the real filesystem — keep unit tests hermetic.

## Fixtures and Factories

**Test Data:**
```typescript
const readFile = () =>
  JSON.stringify({
    providers: {
      "cline-pass": { settings: { apiKey: "cline_static_key" } },
    },
  });
```
(`tests/unit/logic.test.ts:53-58`) — inline `JSON.stringify(...)` literals per test; no shared fixtures.

**Location:**
- None — no `fixtures/` or `__fixtures__/` directory. All data is inline within each `it`.

## Coverage

**Requirements:** None enforced — no coverage thresholds in `vitest.config.ts` or CI (`npm test` runs `vitest run` only).

**View Coverage:**
```bash
# Not configured; would require adding `--coverage` and a provider.
vitest run --coverage
```


## Test Types

**Unit Tests:**
- Scope: pure logic in `src/logic.ts` only (`resolveApiKey`, `defaultAuthPaths`, `modelIds`, `MODELS`, constants, `resolveApiBase`, `sanitizeApiKey`, `buildEndpointUrl`).
- Approach: dependency injection (`AuthKeyOptions`) keeps them hermetic — no FS, no network, no pi runtime. `src/index.ts` and `src/oauth.ts` are NOT unit-tested (async/runtime).

**Integration Tests:**
- None.

**E2E Tests:**
- Bash script `tests/e2e/smoke.sh` — invokes the real `pi` CLI: `pi --no-extensions -e "$PROVIDER_PATH" --model "clinepass/$model" --no-tools -p "$prompt"` (`tests/e2e/smoke.sh:49-53`).
- Requires `CLINE_API_KEY` env var and `pi` globally installed; runs auth check + model smoke tests + error handling (invalid key/model).
- CI (`.github/workflows/ci.yml`) runs E2E only on `workflow_dispatch` with `run_e2e=true` (job `e2e`, gated by `if: github.event.inputs.run_e2e == 'true'`); unit tests run on every push/PR to `main`.

## Common Patterns

**Async Testing:**
- The unit suite has no async tests — all tested `src/logic.ts` functions are synchronous. Async functions in `src/oauth.ts` (`login`, `refreshToken`) are exercised only through E2E.

**Error Testing:**
```typescript
it("returns undefined when no key is available", () => {
  const readFile = () => {
    throw new Error("ENOENT");
  };
  const fileExists = () => false;
  expect(resolveApiKey(undefined, { readFile, fileExists })).toBeUndefined();
});

it("skips malformed auth.json", () => {
  const readFile = () => "not json";
  const fileExists = () => true;
  expect(resolveApiKey(undefined, { readFile, fileExists })).toBeUndefined();
});
```
(`tests/unit/logic.test.ts:105-117`) — verifies graceful degradation (returns `undefined`) rather than thrown errors; mocks `readFile` to throw `Error("ENOENT")` to simulate missing files.

---

*Testing analysis: 2026-06-30*

