# CONVENTIONS.md — Coding Conventions

## Language & Style

| Aspect        | Convention                                                    |
| ------------- | ------------------------------------------------------------- |
| Language      | TypeScript (strict mode)                                      |
| Module system | ESM (`import`/`export`, `.js` extensions in relative imports) |
| Strictness    | `strict: true`, `noEmit: true`, `skipLibCheck: true`          |
| Formatting    | `oxfmt` (Rust-based formatter)                                |
| Linting       | `oxlint` with typescript, unicorn, oxc, import, jest plugins  |
| Lib           | `["ES2022"]` — no DOM (Node-only extension)                   |
| Types         | `["node"]` — Node.js globals only                             |

## Import Style

- Relative imports use `.js` extensions: `import { ... } from "./logic.js"`
- Type-only imports use `import type { ... }`: `import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"`
- Imports grouped: external packages first, then internal modules

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { resolveApiBase, resolveApiKey, resolveModels } from "./logic.js";
import { getApiKey as oauthGetApiKey, login, refreshToken } from "./oauth.js";
```

## Type Patterns

- **No `any` type** — use `unknown` and narrow with type guards
- **Type guards** as standalone functions: `isRecord()`, `stringValue()`, `numberValue()`, `booleanValue()`
- **Interfaces** for object shapes, **type aliases** for unions
- **Readonly** where possible: `readonly ModelConfig[]`, `readonly ["text"]`

```typescript
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

## Dependency Injection

All I/O is parameterized via options objects for testability:

```typescript
export interface AuthKeyOptions {
  env?: Record<string, string | undefined>;
  authPaths?: readonly string[];
  homeDir?: () => string;
  readFile?: (path: string) => string;
  fileExists?: (path: string) => boolean;
}
```

- Functions accept optional `options` parameter with injectable I/O
- Default to real implementations (`process.env`, `readFileSync`, `existsSync`)
- Tests pass mock implementations — no FS or network access needed

## Error Handling

| Pattern                                   | Where                          | Example                                                      |
| ----------------------------------------- | ------------------------------ | ------------------------------------------------------------ |
| `console.warn` for non-fatal warnings     | `src/logic.ts`, `src/oauth.ts` | `[clinepass] Warning: failed to read auth file`              |
| `console.error` for UI-less error surface | `src/index.ts`                 | `[clinepass] ClinePass subscription required...`             |
| `throw new Error()` for fatal failures    | `src/oauth.ts`                 | `throw new Error("ClinePass token refresh failed...")`       |
| `ctx.ui.notify()` for user-facing errors  | `src/index.ts`                 | `ctx.ui.notify(friendlyMessage, "error")`                    |
| Silent catch with fallback                | `src/logic.ts`                 | `fetchRemoteModels` catches all errors → returns `undefined` |

### Error Classification Pattern

```typescript
export function classifyClinePassError(errorMessage: string): {
  type: ClinePassErrorType;
  message: string;
};
```

Errors are pattern-matched on lowercased message text for HTTP status codes and keywords. User-friendly messages are stored in a constant map (`CLINEPASS_ERROR_MESSAGES`).

## Section Organization

Files use `// ─── Section Name ───...` comment dividers:

```typescript
// ─── Constants ──────────────────────────────────────────────────────────────
// ─── Model Definitions ─────────────────────────────────────────────────────
// ─── Dynamic Model Discovery ───────────────────────────────────────────────
// ─── API Key Resolution ──────────────────────────────────────────────────────
// ─── WorkOS OAuth Token Support ─────────────────────────────────────────────
// ─── Error Classification ───────────────────────────────────────────────────
// ─── Environment Helpers ────────────────────────────────────────────────────
```

## JSDoc Conventions

- Module-level JSDoc at top of file with `@module` tag
- Function JSDoc with `@param`, `@returns` for exported functions
- Inline comments for "why" not "what"
- References to external docs: `per Cline PR #11355`, `https://docs.cline.bot/...`

## Naming Conventions

| Category    | Convention            | Example                                   |
| ----------- | --------------------- | ----------------------------------------- |
| Constants   | UPPER_SNAKE_CASE      | `DEFAULT_API_BASE`, `WORKOS_TOKEN_PREFIX` |
| Functions   | camelCase             | `resolveApiKey`, `fetchRemoteModels`      |
| Interfaces  | PascalCase            | `ModelConfig`, `AuthKeyOptions`           |
| Types       | PascalCase            | `ClinePassErrorType`                      |
| Type guards | `isXxx()` / `isXxx()` | `isRecord`, `isWorkosToken`               |
| Parsers     | `parseXxx()`          | `parseRemoteModel`                        |
| Resolvers   | `resolveXxx()`        | `resolveApiKey`, `resolveModels`          |
| Builders    | `buildXxx()`          | `buildEndpointUrl`                        |
| Sanitizers  | `sanitizeXxx()`       | `sanitizeApiKey`                          |

## Lint Overrides

Test files disable `unicorn/consistent-function-scoping` (test helpers are local):

```json
{
  "overrides": [
    {
      "files": ["tests/**/*.test.ts"],
      "rules": {
        "unicorn/consistent-function-scoping": "off"
      }
    }
  ]
}
```
