# NightCityVerse

![CI](https://github.com/eruizpy/nightcityverse/actions/workflows/ci.yml/badge.svg)
![Docker Build](https://github.com/eruizpy/nightcityverse/actions/workflows/docker-publish.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)

NightCityVerse is a standalone visual runtime for observing and editing an AI-agent world.

## Open Source

- License: MIT (see [LICENSE](LICENSE))
- This repository is open source and contributions are welcome via PR.
- For community rules, see [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md) and [CONTRIBUTING](CONTRIBUTING.md).
- For security reporting, see [SECURITY](SECURITY.md).

## Scope

- Pixel-art world rendered in Canvas 2D
- WebSocket live state updates
- HTTP adapter for external orchestrators
- Optional world editing through `anthropic`, `openai`, or `ollama`

## Runtime contract

NightCityVerse does not own NitroCircus state.
It only exposes integration endpoints:

- `POST /api/heartbeat`
- `POST /api/act`
- `POST /api/edit`
- `GET /api/providers`
- `POST /api/providers/select`
- `GET /api/health`

## Local run

```bash
npm install
npm run dev --workspace=nightcityverse
```

## Environment

- `NIGHTCITYVERSE_PORT`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_BASE_URL`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`

`MINIVERSE_PORT` is accepted only as a temporary compatibility fallback.

## Docker-only runtime requirement

NightCityVerse now enforces execution inside a container.
At startup, `server/index.ts` checks typical container signals (`/.dockerenv`, `/proc/1/cgroup`), and exits with code 1 outside Docker unless `FORCE_CONTAINER=true` is set.

Build locally:

```bash
docker build -t nightcityverse:latest .
```

Run container:

```bash
docker run -p 4321:4321 --rm -e FORCE_CONTAINER=true nightcityverse:latest
```

Or with Compose:

```bash
docker compose up --build
```

## Security & SDLC hardening

- Fastify body limit set to 1MB to prevent large JSON DOS.
- Enforced `Content-Type: application/json` on POST endpoints.
- Request schema validation for all API routes.
- Strict patch validation for tile coordinates and agent state.
- LLM prompts trimmed to 512 characters and output parsing resilient.
- Central provider whitelist (`anthropic`, `openai`, `ollama`) with safe transitions.
## DevOps / CI checklist

- Run `npm run lint` and `npm test` on pull requests
- Use `npm audit` regularly for dependency vulnerabilities
- Keep `.env` secrets outside source control and use secret stores in CI/CD

