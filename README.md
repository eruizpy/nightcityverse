# NightCityVerse

NightCityVerse is a standalone visual runtime for observing and editing an AI-agent world.

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
