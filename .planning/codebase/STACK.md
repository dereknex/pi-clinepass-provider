# Technology Stack

**Analysis Date:** 2026-06-30

## Languages

**Primary:**
- TypeScript (target `ES2022`, module `ESNext`, `strict: true`, `moduleResolution: "bundler"`, `noEmit: true`) — all source in `src/index.ts`, `src/logic.ts`, `src/oauth.ts`; tests in `tests/unit/logic.test.ts`. Configured in `tsconfig.json`.

**Secondary:**
- Bash — E2E smoke harness `tests/e2e/smoke.sh` (drives `pi` + `curl` against the live Cline API).
- YAML — GitHub Actions workflow `.github/workflows/ci.yml`.
- TOML — pre-commit config `prek.toml`.
- JSON — tooling configs `package.json`, `.oxlintrc.json`, `.oxfmtrc.json`, `vitest.config.ts` (TS), `bun.lock`.

## Runtime

**Environment:**
- Node.js 22 (pinned in CI via `actions/setup-node@v4` `node-version: 22` in `.github/workflows/ci.yml`). Local dev machine observed at Node v24.16.0.
- `@types/node` `^26.0.1` (resolved `26.0.1` in `bun.lock`).
- pi loads `.ts` source directly — no build/emit step (`tsconfig.json` sets `noEmit: true`; `package.json` `main`/`types` point at `src/index.ts`).

**Package Manager:**
- npm (scripts use `npm ci` / `npm test` in CI and `AGENTS.md`; `package.json` defines `npm run *` scripts).
- bun lockfile also present: `bun.lock` (lockfileVersion 1). Lockfile: present.

## Frameworks

**Core:**
- pi extension runtime — this project is a provider plugin, not an application. It registers itself via `pi.registerProvider()` against the `ExtensionAPI` from `@earendil-works/pi-coding-agent` (`src/index.ts`). There is no web/server framework.

**Testing:**
- Vitest `^4.1.5` (resolved `4.1.9` in `bun.lock`) — unit test runner; config in `vitest.config.ts` (includes `tests/**/*.test.ts`). Unit tests use dependency injection (mock `readFile`, `fileExists`, `env`) — no FS/network.

**Build/Dev:**
- TypeScript `^6.0.3` (resolved `6.0.3`) — `tsc` used for typecheck only (`npm run typecheck`); no emit.
- oxlint — linting (`npm run lint` → `oxlint --config .oxlintrc.json src/ tests/`); config `.oxlintrc.json` (plugins: typescript, unicorn, oxc, import, jest; categories correctness=error, suspicious=warn). Installed as a system CLI, not an npm dep.
- oxfmt — formatting (`npm run format` / `format:check`); config `.oxfmtrc.json`. System CLI.
- prek — pre-commit hooks (`prek.toml`): builtin hooks (trailing-whitespace, end-of-file-fixer, check-added-large-files, check-json, check-toml, check-yaml) plus local `oxlint` and `oxfmt --check` hooks.

## Key Dependencies

**Critical:**
- `@earendil-works/pi-coding-agent` `^0.80.2` (peer + dev; resolved `0.80.2`) — provides `ExtensionAPI` type imported in `src/index.ts:21`; this is the host that loads the extension and provides the `openai-completions` streaming engine.
- `@earendil-works/pi-ai` `^0.80.2` (peer + dev; resolved `0.80.2`) — provides `OAuthCredentials` and `OAuthLoginCallbacks` types imported in `src/oauth.ts:14`.
- `@earendil-works/pi-agent-core` `0.80.2` (transitive via pi-coding-agent).

**Infrastructure:**
- `@types/node` `^26.0.1` (resolved `26.0.1`) — Node stdlib typings (`node:fs`, `node:os`, `node:path` used in `src/logic.ts:10-12`).
- `typescript` `^6.0.3` (resolved `6.0.3`) — type checking.
- `vitest` `^4.1.5` (resolved `4.1.9`) — test framework.
- oxlint / oxfmt / prek — external system CLIs invoked via npm scripts and pre-commit hooks (not npm dependencies).

**Note on transitive AI SDKs:** `@earendil-works/pi-ai` pulls in `@anthropic-ai/sdk`, `@aws-sdk/client-bedrock-runtime`, `@google/genai`, `@mistralai/mistralai`, `openai`, and `@opentelemetry/api` (see `bun.lock`). These are part of the pi runtime and are NOT imported or used directly by this extension's own source.

## Configuration

**Environment:**
- `CLINE_API_KEY` — ClinePass bearer API key (read in `src/logic.ts` via `ENV_API_KEY` constant, default `process.env`). Required for runtime and E2E tests.
- `CLINE_API_BASE` — optional override of the API endpoint; default `https://api.cline.bot` (see `resolveApiBase` in `src/logic.ts:276`).
- Auth-file fallbacks (no env var needed if present): `~/.cline/data/settings/providers.json` and `~/.pi/agent/auth.json` (see `defaultAuthPaths` in `src/logic.ts:168`).

**Build:**
- `tsconfig.json` — `noEmit: true`, strict, ES2022/ESNext, includes `src/**/*.ts` and `tests/**/*.ts`.
- `vitest.config.ts` — test glob `tests/**/*.test.ts`.
- `.oxlintrc.json` — lint rules; test override disables `unicorn/consistent-function-scoping`.
- `.oxfmtrc.json` — formatter config (empty ignorePatterns).
- `prek.toml` — pre-commit hook definitions.
- `package.json` `pi.extensions` field declares `./src/index.ts` as the extension entry.

## Platform Requirements

**Development:**
- Node.js 22+ (CI-pinned; `@types/node` ^26).
- `pi` coding agent (`@earendil-works/pi-coding-agent`) for running/E2E testing the extension.
- System CLIs on PATH: `oxlint`, `oxfmt`, `prek` (for lint/format/pre-commit).
- `npm install` is sufficient — peer deps are mirrored in `devDependencies` (per `AGENTS.md`).

**Production:**
- No server deployment. Distributed as a pi extension: `pi install git:github.com/jellydn/pi-clinepass-provider` (or local path / `pi -e`). Runs wherever the pi coding agent runs; the extension itself executes inside the pi process.

---

*Stack analysis: 2026-06-30*
