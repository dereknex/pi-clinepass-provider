# pi-clinepass-provider — Agent Guide

## Identity

pi extension that registers ClinePass as a model provider via pi's built-in `openai-completions` streaming. Entry point: `src/index.ts` (default export receiving `ExtensionAPI`).

## Commands

| Command                | What it does                                           |
| ---------------------- | ------------------------------------------------------ |
| `npm test`             | Unit tests via Vitest                                  |
| `npm run test:watch`   | Watch mode                                             |
| `npm run test:e2e`     | E2E smoke tests (requires `CLINE_API_KEY` + `pi`)      |
| `npm run lint`         | Lint all source/test files with oxlint                 |
| `npm run format`       | Format all source/test files with oxfmt (in-place)     |
| `npm run format:check` | Check formatting without writing                       |
| `npm run typecheck`    | TypeScript type checking (no emit via tsconfig)        |

`tsconfig.json` has `noEmit: true` — pi loads `.ts` source directly. No build step.

## Architecture

- **`src/index.ts`** — Extension entry. Calls `pi.registerProvider()`, wires models + OAuth + API base.
- **`src/logic.ts`** — Pure logic: model definitions, API key resolution (env var → `~/.cline/auth.json` → `~/.pi/agent/auth.json`), sanitization, URL builder. All I/O parameterized for testability.
- **`src/oauth.ts`** — `/login` flow: opens browser, user pastes key, stores with 10-year expiry.

## Testing

- Unit tests in `tests/unit/` use dependency injection (mock `readFile`, `fileExists`, `env`) — no FS or network. `vitest.config.ts` includes `tests/**/*.test.ts`.
- E2E tests (`tests/e2e/smoke.sh`) run `pi --no-extensions -e <provider_path>` with real API key. Requires `pi` globally installed and `CLINE_API_KEY` set.
- CI runs unit tests on `push`/`PR` to `main`; E2E only on `workflow_dispatch` with `run_e2e=true`.

## Install

```bash
pi install git:github.com/jellydn/pi-clinepass-provider
# or local: pi install /path/to/this/repo
# or quick test: pi -e /path/to/this/repo
```

## Key gotchas

- **Pre-commit hooks via prek** — run `prek install` after cloning, or `prek run --all-files` to check manually.
- **Local dev setup:** `npm install` is sufficient — peer deps (`@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`) are in `devDependencies`.
- Module IDs use prefix `cline-pass/` (e.g. `cline-pass/deepseek-v4-flash`). When invoking pi, use `--model clinepass/cline-pass/...`.
- `CLINE_API_BASE` env var overrides the API endpoint (default: `https://api.cline.bot`).
- Lint disables `unicorn/consistent-function-scoping` in test files (`.oxlintrc.json` override).
