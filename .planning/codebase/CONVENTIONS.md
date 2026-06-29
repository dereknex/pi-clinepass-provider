# Coding Conventions

**Analysis Date:** 2026-06-30

## Naming Patterns

**Files:**
- Source files use lowercase single-word, responsibility-driven names: `src/index.ts`, `src/logic.ts`, `src/oauth.ts`.
- Unit test files use `<module>.test.ts` (e.g., `tests/unit/logic.test.ts`); E2E uses a shell script named `tests/e2e/smoke.sh`.
- Config files are dotfiles: `.oxlintrc.json`, `.oxfmtrc.json`, `.gitignore`; tooling config as `prek.toml`, `vitest.config.ts`, `tsconfig.json`.

**Functions:**
- `camelCase` for all functions: `resolveApiKey`, `resolveApiBase`, `sanitizeApiKey`, `buildEndpointUrl`, `modelIds`, `defaultAuthPaths`, `getApiKey` (in `src/logic.ts` / `src/oauth.ts`).
- Type-guard predicates named `is<Type>` returning type predicates: `isRecord(value: unknown): value is Record<string, unknown>` (`src/logic.ts:16`).
- Tiny value-extractors named `stringValue` (`src/logic.ts:20`).
- The entry point is an anonymous default export: `export default function (pi: ExtensionAPI)` (`src/index.ts:35`).

**Variables:**
- `camelCase` for locals and parameters: `apiBase`, `providedKey`, `authPath`, `accessToken`, `apiKey`.
- `UPPER_SNAKE_CASE` for module-level constants: `DEFAULT_API_BASE`, `DEFAULT_ENDPOINT`, `ENV_API_KEY`, `PROVIDER_NAME`, `MODELS` (`src/logic.ts:26-34`), `DASHBOARD_URL`, `TEN_YEARS_MS` (`src/oauth.ts:17-18`).

**Types:**
- `interface` in `PascalCase`: `ModelConfig`, `AuthKeyOptions` (`src/logic.ts:49`, `src/logic.ts:175`).
- Type-only imports via `import type`: `import type { ExtensionAPI }` (`src/index.ts:21`), `import type { OAuthCredentials, OAuthLoginCallbacks }` (`src/oauth.ts:14`).
- `readonly` modifiers for immutability: `readonly ModelConfig[]`, `readonly ["text"]` tuple (`src/logic.ts:53,59`), `readonly string[]` (`src/logic.ts:177`).
- Numeric separators for readability: `200_000`, `131_072`, `1_000_000`, `1_048_576` (`src/logic.ts:66,93,129`).

## Code Style

**Formatting:**
- Tool: **oxfmt** (`npm run format` / `format:check`), config in `.oxfmtrc.json` (empty config — uses defaults, `ignorePatterns: []`).
- Double quotes for all strings; semicolons present; trailing commas in multiline objects/arrays.
- Section-divider comments using box-drawing characters:
  ```typescript
  // ─── Type helpers ────────────────────────────────────────────────────────────
  ```
  (`src/logic.ts:14,24,36,160,271` — same style echoed in `tests/unit/logic.test.ts:16,120,130,167,187,201,218`).
- No build step — `tsconfig.json` has `noEmit: true`; pi loads `.ts` source directly (`AGENTS.md`).

**Linting:**
- Tool: **oxlint** (`npm run lint` runs `oxlint --config .oxlintrc.json src/ tests/`).
- Plugins: `typescript`, `unicorn`, `oxc`, `import`, `jest` (`.oxlintrc.json`).
- Categories: `correctness: "error"`, `suspicious: "warn"`.
- Env: `builtin: true`, `node: true`.
- Override: `unicorn/consistent-function-scoping: "off"` for `tests/**/*.test.ts` (`.oxlintrc.json:15-21`) so test-local helpers don't trip the rule.
- Pre-commit hooks via **prek** (`prek.toml`): `trailing-whitespace`, `end-of-file-fixer`, `check-added-large-files`, `check-json`, `check-toml`, `check-yaml`, plus local `oxlint --config .oxlintrc.json` and `oxfmt --check`.
- TypeScript config (`tsconfig.json`): `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `strict: true`, `noEmit: true`, `skipLibCheck`, `esModuleInterop`, `forceConsistentCasingInFileNames`, `lib: ["ES2022", "DOM"]`, `types: ["node"]`.

## Import Organization

**Order:**
1. Node built-in modules with `node:` prefix: `import { existsSync, readFileSync } from "node:fs";` (`src/logic.ts:10-12`).
2. External package imports — type-only via `import type`: `import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";` (`src/index.ts:21`), `import type { OAuthCredentials, OAuthLoginCallbacks } from "@earendil-works/pi-ai";` (`src/oauth.ts:14`).
3. Local relative imports with `.js` extension: `import { resolveApiBase, MODELS, PROVIDER_NAME, ENV_API_KEY } from "./logic.js";` (`src/index.ts:22-23`).

Aliasing used to avoid name collisions: `import { getApiKey as oauthGetApiKey, login, refreshToken } from "./oauth.js";` (`src/index.ts:23`).

**Path Aliases:**
- None. All local imports are relative paths carrying a `.js` extension even though sources are `.ts` (ESM convention under `moduleResolution: bundler`): `./logic.js`, `./oauth.js`, `../../src/logic.js`.

## Error Handling

**Patterns:**
- Throw a plain `Error` with a descriptive message for invalid user input:
  ```typescript
  if (!apiKey) throw new Error("No ClinePass API key provided");
  ```
  (`src/oauth.ts:46`)
- Resilient I/O uses `try`/`catch` with a silent ignore — auth files that are missing or malformed are skipped, not fatal:
  ```typescript
  try {
    if (!fileExists(authPath)) continue;
    const parsed: unknown = JSON.parse(readFile(authPath));
    // ...
  } catch {
    // ignore malformed or unreadable auth files
  }
  ```
  (`src/logic.ts:242-265`)
- Resolution functions return `undefined` rather than throwing when nothing is found: `resolveApiKey(...)`: `string | undefined` (`src/logic.ts:228-269`).
- Optional-injection defaults fall back to real implementations so production works without args: `options: AuthKeyOptions = {}`, `env = process.env`, `readFile ?? ((p) => readFileSync(p, "utf-8"))` (`src/logic.ts:230-240`).
- E2E shell uses `set -euo pipefail` plus `|| true` on individual commands to capture and count failures rather than abort (`tests/e2e/smoke.sh:10,53,120-125`).


## Logging

**Framework:** None — no logging framework or `console.*` calls in `src/`. Source modules are silent by design (logic is pure; the entry point only registers with pi).

**Patterns:**
- The only output lives in the E2E shell script, which uses `echo -e` with ANSI color codes (`RED`/`GREEN`/`YELLOW`/`NC`) and a `PASS`/`FAIL`/`SKIP` counter (`tests/e2e/smoke.sh:12-19,156-160`).
- When adding diagnostics, prefer returning structured values from pure logic over side-effecting logs, so tests stay deterministic.

## Comments

**When to Comment:**
- Every source file opens with a file-level JSDoc block stating its responsibility and `@module` tag (`src/logic.ts:1-8`, `src/oauth.ts:1-12`, `src/index.ts:1-19`).
- Use box-drawing section dividers to group related constants/functions (see Code Style).
- Inline comments explain **why**, not what: `// all ClinePass models support reasoning` (`tests/unit/logic.test.ts:161`), `// Qwen3.7 Plus has tiered pricing; we use the ≤256K rate as the default.` (`src/logic.ts:146`).
- Multi-line `// Note on ...` blocks document non-obvious design decisions and future-extension hints (`src/index.ts:25-31`).

**JSDoc/TSDoc:**
- `/** ... */` blocks on exported functions/constants describe purpose, priority order, and file-format expectations. Example (`src/logic.ts:217-227`):
  ```typescript
  /**
   * Resolve the ClinePass API key.
   * Priority: provided key → CLINE_API_KEY env var → auth files
   *
   * Auth files checked:
   * - ~/.cline/data/settings/providers.json (Cline CLI nested format): ...
   * - ~/.pi/agent/auth.json (pi OAuth format): ...
   */
  ```
- `@module` tag used in file headers (`src/logic.ts:7`, `src/index.ts:18`).
- `@param`/`@returns` are NOT used — types are self-documenting; prose describes behavior and edge cases instead.


## Function Design

**Size:** Small, single-responsibility functions. The largest is `resolveApiKey` (~40 lines, `src/logic.ts:228-269`); helpers like `isRecord` and `stringValue` are 1-3 lines (`src/logic.ts:16-22`).

**Parameters:** Options-object pattern for testability. Injectable dependencies are optional with defaults falling back to real I/O:
```typescript
export interface AuthKeyOptions {
  env?: Record<string, string | undefined>;
  authPaths?: readonly string[];
  homeDir?: () => string;
  readFile?: (path: string) => string;
  fileExists?: (path: string) => boolean;
}

export function resolveApiKey(
  providedKey?: string,
  options: AuthKeyOptions = {},
): string | undefined {
  // ...
  const readFile = options.readFile ?? ((p: string) => readFileSync(p, "utf-8"));
  const fileExists = options.fileExists ?? ((p: string) => existsSync(p));
  // ...
}
```
(`src/logic.ts:175-181,228-240`) — this lets unit tests inject mock `readFile`/`fileExists`/`env` with no FS or network.

**Return Values:** Explicit return types on all exported functions: `string | undefined`, `string[]`, `string`, `OAuthCredentials` (Promise). Type guards return type predicates (`value is Record<string, unknown>`).

## Module Design

**Exports:**
- Named exports for all logic (`resolveApiKey`, `resolveApiBase`, `sanitizeApiKey`, `buildEndpointUrl`, `modelIds`, `defaultAuthPaths`, `MODELS`, constants, types) — `src/logic.ts`.
- Named exports for OAuth flow (`login`, `refreshToken`, `getApiKey`) — `src/oauth.ts`.
- A single **default export** only for the entry point `src/index.ts:35` (the pi extension function).
- Internal helpers (`isRecord`, `stringValue`, `resolveClineProvidersKey`, `credentialsFromApiKey`) are intentionally **not** exported — kept module-private.

**Barrel Files:** None. Modules import directly from each other (`./logic.js`, `./oauth.js`); tests import directly from `../../src/logic.js`. No `index.ts` aggregator beyond the entry point.

---

*Convention analysis: 2026-06-30*

