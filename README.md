# Welcome to pi-clinepass-provider 🚀

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/jellydn/pi-clinepass-provider/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/jellydn/pi-clinepass-provider/workflows/CI/badge.svg)](https://github.com/jellydn/pi-clinepass-provider/actions)

> ClinePass provider for [pi](https://github.com/earendil-works/pi) — 10 curated open-weight coding models (GLM-5.2, Kimi K2.7 Code, DeepSeek V4, Qwen3.7, and more) through Cline's $9.99/month subscription with 2-5x standard API rate limits.

ClinePass uses Cline's **OpenAI-compatible Chat Completions API**, so no custom streaming protocol is needed — pi's built-in `openai-completions` streaming handles SSE parsing, tool calls, and usage tracking.

## 🏠 [Homepage](https://github.com/jellydn/pi-clinepass-provider)

## Pre-requirements

- [pi](https://github.com/earendil-works/pi) coding agent
- A [ClinePass](https://docs.cline.bot/getting-started/clinepass) subscription — $9.99/month

## Features

- Full streaming via Cline's OpenAI-compatible `/api/v1/chat/completions` endpoint
- Per-token cost tracking against ClinePass reference pricing
- API key auto-discovery from `CLINE_API_KEY` env var, `~/.cline/auth.json`, or `~/.pi/agent/auth.json`
- 10 curated open-weight coding models with tool call support
- `/login` integration — browser-assisted + manual paste API key flow

## Supported Models

| Model             | Model ID                       | Context |
| :---------------- | :----------------------------- | :------ |
| GLM-5.2           | `cline-pass/glm-5.2`           | 200K    |
| Kimi K2.7 Code    | `cline-pass/kimi-k2.7-code`    | 262K    |
| Kimi K2.6         | `cline-pass/kimi-k2.6`         | 262K    |
| DeepSeek V4 Pro   | `cline-pass/deepseek-v4-pro`   | 1M      |
| DeepSeek V4 Flash | `cline-pass/deepseek-v4-flash` | 1M      |
| MiMo-V2.5         | `cline-pass/mimo-v2.5`         | 262K    |
| MiMo-V2.5-Pro     | `cline-pass/mimo-v2.5-pro`     | 262K    |
| MiniMax M3        | `cline-pass/minimax-m3`        | 1M      |
| Qwen3.7 Max       | `cline-pass/qwen3.7-max`       | 262K    |
| Qwen3.7 Plus      | `cline-pass/qwen3.7-plus`      | 1M      |

## Install

```sh
# From git (recommended)
pi install git:github.com/jellydn/pi-clinepass-provider

# Or from local path
git clone https://github.com/jellydn/pi-clinepass-provider.git
pi install /path/to/pi-clinepass-provider

# Quick test without installing
pi -e /path/to/pi-clinepass-provider
```

## API Key Setup

1. Subscribe to ClinePass at [app.cline.bot](https://app.cline.bot), go to **Settings → API Keys** and click **Generate API key**. Copy it.
2. Set the environment variable:

```sh
echo 'export CLINE_API_KEY="your_key_here"' >> ~/.zshrc
source ~/.zshrc
```

Alternatively, run `pi /login` and select **ClinePass** — it opens the Cline dashboard and prompts you to paste your key.

<details>
<summary>💡 Already signed in with the Cline CLI?</summary>

If you use the [Cline CLI](https://docs.cline.bot) (`npm i -g cline`) and have already authenticated with ClinePass, your credentials are stored at `~/.cline/data/settings/providers.json` under the `cline-pass` provider. This extension will try to read `apiKey` or `auth.accessToken` from that file automatically as a fallback when `CLINE_API_KEY` is not set.

However, the `accessToken` there is a **short-lived WorkOS OAuth token** (expires ~1 hour after login) that the Cline CLI refreshes internally using its server-side secret. It **cannot** be used directly as `CLINE_API_KEY` for this extension.

To get a long-lived API key that works with this extension:

1. Go to [app.cline.bot](https://app.cline.bot) → **Settings → API Keys**
2. Click **Generate API key**
3. Use that key as your `CLINE_API_KEY`

</details>

## Usage

```sh
# Non-interactive
pi --model clinepass/cline-pass/deepseek-v4-flash -p "Explain async/await in JavaScript"

# Interactive
pi --model clinepass/cline-pass/kimi-k2.7-code

# List available models
pi --list-models clinepass

# Use in another project
cd my-project
pi --model clinepass/cline-pass/glm-5.2 --trust "Refactor the auth module"
```

Switch models in-session with `/model clinepass/cline-pass/glm-5.2`.

## Run tests

```sh
npm test
```

## Pre-commit

This project uses [prek](https://github.com/earendil-works/prek) to enforce code quality. To install hooks:

```sh
prek install
```

## Notes

- **Pricing**: ClinePass is a flat $9.99/month subscription. Per-token costs in the model table are reference values for usage tracking only.
- **Context windows**: estimates from ClinePass docs — verify against Cline's `/models` endpoint.
- **Custom API base**: set `CLINE_API_BASE` env var to override the endpoint (default: `https://api.cline.bot`).

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## Author

- Github: [@jellydn](https://github.com/jellydn)

## Show your support

Give a ⭐️ if this project helped you!
