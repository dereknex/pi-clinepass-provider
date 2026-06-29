# STRUCTURE.md — Directory Structure

## Layout

```
pi-clinepass-provider/
├── .github/
│   └── workflows/
│       └── ci.yml              # CI: matrix tests (latest + min-pi) + E2E smoke
├── .planning/
│   └── codebase/               # Generated codebase maps (this directory)
├── src/
│   ├── index.ts                # Extension entry point — async default export
│   ├── logic.ts                # Pure logic — models, auth, errors, env helpers
│   └── oauth.ts                # OAuth login/refresh flow — WorkOS + static key
├── tests/
│   ├── unit/
│   │   ├── logic.test.ts       # 50+ tests for logic.ts
│   │   ├── oauth.test.ts       # 7 tests for oauth.ts
│   │   └── index.test.ts       # 12 tests for index.ts
│   └── e2e/
│       └── smoke.sh            # E2E smoke tests (real API, manual trigger)
├── package.json                # Project metadata, scripts, deps, pi config
├── package-lock.json           # Lockfile (npm ci compatible)
├── tsconfig.json               # TypeScript config (strict, ESM, noEmit)
├── vitest.config.ts            # Test runner config
├── .oxlintrc.json              # Linter config (oxlint)
├── README.md                   # User-facing documentation
├── AGENTS.md                   # Agent/developer guide
└── LICENSE                     # MIT license
```

## Key Locations

| What                      | Where                                                               |
| ------------------------- | ------------------------------------------------------------------- |
| Extension entry point     | `src/index.ts` → `export default async function (pi: ExtensionAPI)` |
| Model definitions         | `src/logic.ts` → `MODELS` constant (10 models)                      |
| Dynamic model discovery   | `src/logic.ts` → `fetchRemoteModels()`, `resolveModels()`           |
| API key resolution        | `src/logic.ts` → `resolveApiKey()`                                  |
| WorkOS credential parsing | `src/logic.ts` → `resolveClineAuthCredentials()`                    |
| Error classification      | `src/logic.ts` → `classifyClinePassError()`                         |
| OAuth login flow          | `src/oauth.ts` → `login()`                                          |
| Token refresh             | `src/oauth.ts` → `refreshToken()`, `refreshWorkosToken()`           |
| Error event handler       | `src/index.ts` → `pi.on("message_end", ...)`                        |
| CI workflow               | `.github/workflows/ci.yml`                                          |
| E2E tests                 | `tests/e2e/smoke.sh`                                                |

## Naming Conventions

| Category         | Convention               | Example                                                        |
| ---------------- | ------------------------ | -------------------------------------------------------------- |
| Source files     | lowercase, no separators | `index.ts`, `logic.ts`, `oauth.ts`                             |
| Test files       | `<module>.test.ts`       | `logic.test.ts`, `oauth.test.ts`, `index.test.ts`              |
| Constants        | UPPER_SNAKE_CASE         | `DEFAULT_API_BASE`, `MODELS_ENDPOINT`, `WORKOS_TOKEN_PREFIX`   |
| Interfaces       | PascalCase               | `ModelConfig`, `AuthKeyOptions`, `ClineAuthCredentials`        |
| Types            | PascalCase               | `ClinePassErrorType`                                           |
| Functions        | camelCase                | `resolveApiKey`, `fetchRemoteModels`, `classifyClinePassError` |
| Section comments | `// ─── Title ───...`    | `// ─── Model Definitions ───...`                              |

## File Sizes

| File                       | Lines | Role                               |
| -------------------------- | ----- | ---------------------------------- |
| `src/logic.ts`             | ~630  | Largest file — all pure logic      |
| `src/oauth.ts`             | ~200  | OAuth login/refresh                |
| `src/index.ts`             | ~110  | Extension entry (thin)             |
| `tests/unit/logic.test.ts` | ~450  | Most tests                         |
| `tests/unit/index.test.ts` | ~340  | Registration + error handler tests |
| `tests/unit/oauth.test.ts` | ~140  | OAuth tests                        |
| `tests/e2e/smoke.sh`       | ~130  | E2E smoke script                   |
