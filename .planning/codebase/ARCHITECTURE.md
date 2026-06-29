# ARCHITECTURE.md — System Architecture

## Pattern

**pi Extension (Provider Plugin)** — a self-contained TypeScript module that registers a model provider with the pi coding agent. No server, no build step, no framework. Pure logic + thin integration layer.

## Module Dependency Graph

```
src/index.ts  (Extension entry point — async default export)
  ├── src/logic.ts  (Pure logic — models, auth, errors, env)
  └── src/oauth.ts  (Login/refresh flow — depends on logic.ts)
```

```
tests/unit/
  ├── logic.test.ts  (Tests src/logic.ts — 50+ tests)
  ├── oauth.test.ts  (Tests src/oauth.ts — 7 tests)
  └── index.test.ts  (Tests src/index.ts — 12 tests)
```

## Layer Separation

### Layer 1: Pure Logic (`src/logic.ts`)

- **No pi dependency** — fully testable in isolation
- All I/O parameterized via dependency injection (`AuthKeyOptions`, `RemoteModelsOptions`)
- Exports: constants, types, model definitions, auth resolvers, error classifier
- Key functions: `resolveApiKey()`, `resolveClineAuthCredentials()`, `resolveModels()`, `fetchRemoteModels()`, `classifyClinePassError()`

### Layer 2: OAuth Integration (`src/oauth.ts`)

- Depends on `src/logic.ts` for credential parsing and constants
- Implements pi's `OAuthCredentials` / `OAuthLoginCallbacks` interfaces
- Exports: `login()`, `refreshToken()`, `getApiKey()`, `refreshWorkosToken()`
- Two auth paths: WorkOS OAuth (auto-detect from Cline CLI) and static API key (manual paste)

### Layer 3: Extension Entry (`src/index.ts`)

- Thin orchestration layer — wires logic + oauth into pi's `ExtensionAPI`
- Async default export (dynamic model discovery before registration)
- Registers provider with `pi.registerProvider()` and error handler with `pi.on("message_end")`
- No business logic — delegates everything to layers 1-2

## Data Flow

### Registration Flow (startup)

```
1. pi loads src/index.ts via await import()
2. resolveApiBase() → determines API endpoint
3. resolveApiKey() → finds API key (env → Cline CLI config → pi auth.json)
4. resolveModels(apiKey) → tries fetchRemoteModels(), falls back to static MODELS
5. pi.registerProvider("clinepass", {baseUrl, apiKey, api, oauth, models})
6. pi.on("message_end", errorHandler) → surfaces friendly 403/401/429 messages
```

### Request Flow (user sends message)

```
1. pi sends chat completion request to https://api.cline.bot/api/v1/chat/completions
2. Uses openai-completions streaming (pi built-in, no custom streamSimple)
3. SSE stream → pi processes tokens, tool calls, usage
4. On error: message_end event fires with stopReason="error" + errorMessage
5. Our handler classifies error → surfaces friendly message via ctx.ui.notify()
```

### OAuth Refresh Flow

```
1. pi detects token expiry → calls our refreshToken()
2. refreshToken() checks if access token has "workos:" prefix
3. If WorkOS: POST /api/v1/auth/refresh → get new tokens → ensure "workos:" prefix
4. If static key: no-op (keys don't expire)
5. Returns updated OAuthCredentials to pi for persistence
```

## Key Abstractions

| Abstraction            | Location                          | Purpose                             |
| ---------------------- | --------------------------------- | ----------------------------------- |
| `ModelConfig`          | `src/logic.ts`                    | Static model definition shape       |
| `AuthKeyOptions`       | `src/logic.ts`                    | DI interface for auth file I/O      |
| `RemoteModelsOptions`  | `src/logic.ts`                    | DI interface for remote model fetch |
| `ClineAuthCredentials` | `src/logic.ts`                    | WorkOS OAuth credentials shape      |
| `ClinePassErrorType`   | `src/logic.ts`                    | Error classification union type     |
| `OAuthCredentials`     | `@earendil-works/pi-ai`           | pi's credential storage shape       |
| `ExtensionAPI`         | `@earendil-works/pi-coding-agent` | pi's extension API interface        |
| `ProviderConfig`       | `@earendil-works/pi-coding-agent` | Provider registration config shape  |

## Entry Points

| Entry Point                   | Trigger                                               |
| ----------------------------- | ----------------------------------------------------- |
| `src/index.ts` default export | pi loads extension at startup or via `/reload`        |
| `pi.registerProvider()`       | Called during extension init                          |
| `pi.on("message_end")`        | Called during extension init                          |
| `oauth.login()`               | Called when user runs `pi /login` → selects ClinePass |
| `oauth.refreshToken()`        | Called by pi when stored token expires                |

## Design Decisions

1. **No custom `streamSimple`** — ClinePass uses standard OpenAI Chat Completions format, so pi's built-in `openai-completions` streaming handles everything.
2. **Static model fallback** — Dynamic model discovery tries the Cline API first, but falls back to a hardcoded `MODELS` array (10 models) on any error. The API endpoint currently returns 404.
3. **Pure logic separation** — All business logic lives in `src/logic.ts` with injectable I/O, enabling comprehensive unit testing without FS or network access.
4. **Error surface via `message_end`** — The `after_provider_response` event can't be used for error detection because the OpenAI SDK throws before `onResponse` fires for non-2xx status codes. The `message_end` event carries `stopReason: "error"` and `errorMessage` from the stream's catch block.
