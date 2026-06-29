# Codebase Structure

**Analysis Date:** 2026-06-30

## Directory Layout

```
pi-clinepass-provider/
├── .github/workflows/ # CI pipeline (unit + optional E2E)
├── .planning/codebase/ # Generated architecture/structure docs (this file)
├── doc/adr/            # Architecture Decision Records (template + index)
├── src/                # Extension source — entry, pure logic, OAuth
├── tests/
│   ├── e2e/            # Bash smoke tests against the live Cline API
│   └── unit/           # Vitest unit tests (dependency-injected, no FS/network)
├── .gitignore          # Ignores node_modules, dist, *.tsbuildinfo, .DS_Store
├── .oxfmtrc.json       # oxfmt formatter config (empty ignorePatterns)
├── .oxlintrc.json      # oxlint config + test-file rule overrides
├── AGENTS.md           # Agent guide (commands, architecture, gotchas)
├── LICENSE             # MIT
├── README.md           # User-facing docs (install, models, usage)
├── bun.lock            # Bun lockfile
├── package.json        # Manifest: type:module, pi.extensions, scripts, devDeps
├── prek.toml           # prek pre-commit hook config
├── tsconfig.json       # TypeScript config (noEmit, ES2022, strict)
└── vitest.config.ts    # Vitest config (include tests/**/*.test.ts)
```

## Directory Purposes

**`src/`:**
- Purpose: All shipped extension source — the only directory listed in `package.json` → `files` plus tests/README/LICENSE.
- Contains: Three TypeScript modules (entry, pure logic, OAuth).
- Key files: `src/index.ts`, `src/logic.ts`, `src/oauth.ts`

**`tests/unit/`:**
- Purpose: Pure unit tests for `src/logic.ts` using dependency injection (mock `readFile`, `fileExists`, `env`) — no filesystem or network access.
- Contains: One Vitest spec.
- Key files: `tests/unit/logic.test.ts`

**`tests/e2e/`:**
- Purpose: End-to-end smoke tests that invoke the real `pi` binary against Cline's live API.
- Contains: One executable bash script.
- Key files: `tests/e2e/smoke.sh`

**`.github/workflows/`:**
- Purpose: GitHub Actions CI — unit tests on push/PR to `main`, E2E only on `workflow_dispatch` with `run_e2e=true`.
- Contains: One workflow definition.
- Key files: `.github/workflows/ci.yml`

**`doc/adr/`:**
- Purpose: Architecture Decision Records — template and index; no records accepted yet.
- Contains: README index + Markdown template.
- Key files: `doc/adr/README.md`, `doc/adr/template.md`

**`.planning/codebase/`:**
- Purpose: Generated codebase-mapping documents (this file and `ARCHITECTURE.md`).
- Contains: Markdown analysis docs.
- Key files: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`

## Key File Locations

**Entry Points:**
- `src/index.ts`: Extension default export — registers the `clinepass` provider with pi.
- `package.json` → `pi.extensions`: `["./src/index.ts"]` tells pi which file to load.
- `tests/e2e/smoke.sh`: E2E entry — runs `pi --no-extensions -e <provider>` per model.

**Configuration:**
- `package.json`: `type: module`, `main`/`types` = `src/index.ts`, scripts (`test`, `test:e2e`, `lint`, `format`, `typecheck`), peer deps on `@earendil-works/pi-ai` + `@earendil-works/pi-coding-agent`.
- `tsconfig.json`: `noEmit: true`, `target: ES2022`, `moduleResolution: bundler`, `strict`, includes `src/**/*.ts` + `tests/**/*.ts`.
- `vitest.config.ts`: `include: ["tests/**/*.test.ts"]`.
- `.oxlintrc.json`: plugins (typescript, unicorn, oxc, import, jest), `correctness: error`, `suspicious: warn`; test override disables `unicorn/consistent-function-scoping`.
- `.oxfmtrc.json`: empty `ignorePatterns`.
- `prek.toml`: pre-commit hooks — builtin (trailing-whitespace, end-of-file-fixer, check-added-large-files, check-json/toml/yaml) + local (oxlint, oxfmt --check).

**Core Logic:**
- `src/logic.ts`: Model definitions (`MODELS`, `ModelConfig`), `resolveApiKey`, `resolveApiBase`, `sanitizeApiKey`, `buildEndpointUrl`, `defaultAuthPaths`, type guards.
- `src/oauth.ts`: `login`, `refreshToken`, `getApiKey`, `credentialsFromApiKey`.

**Testing:**
- `tests/unit/logic.test.ts`: Unit tests for all exported logic (`resolveApiKey` fallbacks, `modelIds`, `MODELS` invariants, constants, `resolveApiBase`, `sanitizeApiKey`, `buildEndpointUrl`).
- `tests/e2e/smoke.sh`: Bash harness — curl auth check, model smoke tests (DeepSeek V4 Flash, MiMo V2.5, Kimi K2.6), invalid-key and invalid-model error cases.
## Naming Conventions

**Files:**
- kebab-case for config/data files: `.oxlintrc.json`, `.oxfmtrc.json`, `prek.toml`.
- Lowercase nouns for source modules: `index.ts`, `logic.ts`, `oauth.ts`.
- `<module>.test.ts` for unit specs colocated under `tests/unit/`: `logic.test.ts`.
- Shell scripts use lowercase: `smoke.sh`.
- ADR files (per `doc/adr/README.md`): `NNNN-kebab-case-slug.md` (zero-padded, monotonically increasing).

**Directories:**
- Lowercase with optional hyphens: `src`, `tests`, `unit`, `e2e`, `workflows`, `adr`, `codebase`.

## Where to Add New Code

**New Feature:**
- Primary code: Add model entries to the `MODELS` array in `src/logic.ts`; the mapper in `src/index.ts` already forwards `id`, `name`, `reasoning`, `input`, `cost`, `contextWindow`, `maxTokens`.
- Tests: Extend `tests/unit/logic.test.ts` (the `MODELS`/`modelIds` describe blocks assert count and invariants) and add model cases to `tests/e2e/smoke.sh`'s `run_test` calls.

**New Component/Module:**
- Implementation: Add a new `src/<module>.ts` and import it from `src/index.ts` (the wiring layer). Keep pure/testable logic following the `src/logic.ts` dependency-injection pattern.

**Utilities:**
- Shared helpers: Place pure helpers in `src/logic.ts` (exported) so they are covered by `tests/unit/logic.test.ts`; avoid side-effecting code in shared utilities.

## Special Directories

**`node_modules/`:**
- Purpose: Installed dependencies (peer deps `@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent` are in `devDependencies`).
- Generated: Yes (via `npm install` / `bun install`).
- Committed: No (gitignored).

**`dist/`:**
- Purpose: Build output — not used; `tsconfig.json` has `noEmit: true` and pi loads `.ts` directly.
- Generated: Yes (if a build were run).
- Committed: No (gitignored).

**`.planning/codebase/`:**
- Purpose: Generated architecture/structure analysis documents.
- Generated: Yes (by the codebase-mapping agent).
- Committed: Yes (intended to be checked in for planning context).

**`doc/adr/`:**
- Purpose: Architecture Decision Records; currently only the template and index exist (no accepted records).
- Generated: No.
- Committed: Yes.

---

*Structure analysis: 2026-06-30*
