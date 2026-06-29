import { describe, it, expect } from "vitest";
import {
  resolveApiKey,
  defaultAuthPaths,
  modelIds,
  MODELS,
  PROVIDER_NAME,
  ENV_API_KEY,
  DEFAULT_API_BASE,
  DEFAULT_ENDPOINT,
  resolveApiBase,
  sanitizeApiKey,
  buildEndpointUrl,
} from "../../src/logic.js";

// ─── resolveApiKey ──────────────────────────────────────────────────────────

describe("resolveApiKey", () => {
  it("returns provided key first", () => {
    expect(resolveApiKey("cline_provided")).toBe("cline_provided");
  });

  it("falls back to env var", () => {
    expect(resolveApiKey(undefined, { env: { CLINE_API_KEY: "cline_env" } })).toBe("cline_env");
  });

  it("falls back to auth.json with apiKey field", () => {
    const readFile = () => JSON.stringify({ apiKey: "cline_from_file" });
    const fileExists = () => true;
    expect(resolveApiKey(undefined, { readFile, fileExists })).toBe("cline_from_file");
  });

  it("falls back to auth.json with clinepass string field", () => {
    const readFile = () => JSON.stringify({ clinepass: "cline_cp_string" });
    const fileExists = () => true;
    expect(resolveApiKey(undefined, { readFile, fileExists })).toBe("cline_cp_string");
  });

  it("falls back to auth.json with OAuth credentials", () => {
    const readFile = () =>
      JSON.stringify({
        clinepass: {
          type: "oauth",
          access: "cline_oauth_key",
          refresh: "cline_oauth_key",
        },
      });
    const fileExists = () => true;
    expect(resolveApiKey(undefined, { readFile, fileExists })).toBe("cline_oauth_key");
  });

  it("extracts apiKey from Cline CLI nested providers.json (cline-pass)", () => {
    const readFile = () =>
      JSON.stringify({
        providers: {
          "cline-pass": { settings: { apiKey: "cline_static_key" } },
        },
      });
    const fileExists = () => true;
    expect(resolveApiKey(undefined, { readFile, fileExists })).toBe("cline_static_key");
  });

  it("prefers cline-pass apiKey over cline accessToken when both exist", () => {
    const readFile = () =>
      JSON.stringify({
        providers: {
          "cline-pass": { settings: { apiKey: "cline_pass_key" } },
          cline: { settings: { auth: { accessToken: "workos:cline_key" } } },
        },
      });
    const fileExists = () => true;
    expect(resolveApiKey(undefined, { readFile, fileExists })).toBe("cline_pass_key");
  });

  it("extracts auth.accessToken from Cline CLI nested providers.json (cline)", () => {
    const readFile = () =>
      JSON.stringify({
        providers: {
          cline: {
            settings: {
              auth: { accessToken: "workos:oauth_token", refreshToken: "r", expiresAt: 0 },
            },
          },
        },
      });
    const fileExists = () => true;
    expect(resolveApiKey(undefined, { readFile, fileExists })).toBe("workos:oauth_token");
  });

  it("checks ~/.pi/agent/auth.json as fallback", () => {
    const readFile = (p: string) => {
      if (p.includes("providers.json")) throw new Error("ENOENT");
      return JSON.stringify({ apiKey: "cline_from_pi_auth" });
    };
    const fileExists = (p: string) => !p.includes("providers.json");
    expect(
      resolveApiKey(undefined, {
        readFile,
        fileExists,
        authPaths: ["/home/.cline/data/settings/providers.json", "/home/.pi/agent/auth.json"],
      }),
    ).toBe("cline_from_pi_auth");
  });

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
});

// ─── defaultAuthPaths ───────────────────────────────────────────────────────

describe("defaultAuthPaths", () => {
  it("includes Cline CLI providers.json and pi auth.json paths", () => {
    const paths = defaultAuthPaths("/home/user");
    expect(paths).toContain("/home/user/.cline/data/settings/providers.json");
    expect(paths).toContain("/home/user/.pi/agent/auth.json");
  });
});

// ─── modelIds / MODELS ──────────────────────────────────────────────────────

describe("modelIds", () => {
  it("returns all model IDs", () => {
    const ids = modelIds();
    expect(ids).toHaveLength(MODELS.length);
    expect(ids).toContain("cline-pass/glm-5.2");
    expect(ids).toContain("cline-pass/kimi-k2.7-code");
    expect(ids).toContain("cline-pass/deepseek-v4-flash");
  });

  it("all IDs start with cline-pass/", () => {
    for (const id of modelIds()) {
      expect(id.startsWith("cline-pass/")).toBe(true);
    }
  });
});

describe("MODELS", () => {
  it("has 10 curated models", () => {
    expect(MODELS).toHaveLength(10);
  });

  it("all models have valid cost and context fields", () => {
    for (const m of MODELS) {
      expect(m.cost.input).toBeGreaterThanOrEqual(0);
      expect(m.cost.output).toBeGreaterThanOrEqual(0);
      expect(m.cost.cacheRead).toBeGreaterThanOrEqual(0);
      expect(m.cost.cacheWrite).toBeGreaterThanOrEqual(0);
      expect(m.contextWindow).toBeGreaterThan(0);
      expect(m.maxTokens).toBeGreaterThan(0);
      expect(m.reasoning).toBe(true); // all ClinePass models support reasoning
      expect(m.input).toEqual(["text"]);
    }
  });
});

// ─── Constants ──────────────────────────────────────────────────────────────

describe("constants", () => {
  it("exports correct provider name", () => {
    expect(PROVIDER_NAME).toBe("clinepass");
  });

  it("exports correct env var name", () => {
    expect(ENV_API_KEY).toBe("CLINE_API_KEY");
  });

  it("exports correct default API base", () => {
    expect(DEFAULT_API_BASE).toBe("https://api.cline.bot");
  });

  it("exports correct endpoint path", () => {
    expect(DEFAULT_ENDPOINT).toBe("/api/v1/chat/completions");
  });
});

// ─── resolveApiBase ─────────────────────────────────────────────────────────

describe("resolveApiBase", () => {
  it("returns default when env not set", () => {
    expect(resolveApiBase({})).toBe(DEFAULT_API_BASE);
  });

  it("returns override from CLINE_API_BASE", () => {
    expect(resolveApiBase({ CLINE_API_BASE: "https://custom.example.com" })).toBe(
      "https://custom.example.com",
    );
  });
});

// ─── sanitizeApiKey ─────────────────────────────────────────────────────────

describe("sanitizeApiKey", () => {
  it("trims whitespace", () => {
    expect(sanitizeApiKey("  cline_test  ")).toBe("cline_test");
  });

  it("removes terminal paste wrappers", () => {
    const esc = String.fromCharCode(27);
    expect(sanitizeApiKey(`${esc}[200~cline_test${esc}[201~`)).toBe("cline_test");
  });

  it("removes control characters", () => {
    expect(sanitizeApiKey("cline_\x00test")).toBe("cline_test");
  });
});

// ─── buildEndpointUrl ───────────────────────────────────────────────────────

describe("buildEndpointUrl", () => {
  it("builds the full chat completions URL", () => {
    expect(buildEndpointUrl(DEFAULT_API_BASE)).toBe(
      "https://api.cline.bot/api/v1/chat/completions",
    );
  });

  it("works with a custom base", () => {
    expect(buildEndpointUrl("https://staging.cline.bot")).toBe(
      "https://staging.cline.bot/api/v1/chat/completions",
    );
  });
});
