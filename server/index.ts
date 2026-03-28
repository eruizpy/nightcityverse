import Fastify from 'fastify'
import staticPlugin from '@fastify/static'
import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { World } from './world.js'
import type { AgentAnimState } from './world.js'
import {
  editWorldWithLLM,
  getActiveProvider,
  setActiveProvider,
  getProviderStatuses,
  type LLMProvider,
} from './llm.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const IS_DEV    = process.env.NODE_ENV !== 'production'
const PORT      = Number(process.env.NIGHTCITYVERSE_PORT ?? process.env.MINIVERSE_PORT ?? 4321)

const ALLOWED_PROVIDERS = ['anthropic', 'openai', 'ollama'] as const

// ── HTTP Server ───────────────────────────────────────────────────────────────

const httpServer = createServer()

const app = Fastify({
  serverFactory: (handler) => {
    httpServer.on('request', handler)
    return httpServer
  },
  logger: false,
  bodyLimit: 1_048_576, // 1MB
})

app.addHook('onRequest', async (req, reply) => {
  if (req.method === 'POST' && !req.headers['content-type']?.includes('application/json')) {
    reply.status(415).send({ error: 'Unsupported Media Type: application/json required' })
  }
})

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error)
  const status = error.statusCode && Number.isFinite(error.statusCode) ? error.statusCode : 500
  reply.status(status).send({ error: 'Internal server error' })
})

// Serve built frontend in production
if (!IS_DEV) {
  await app.register(staticPlugin, {
    root: join(__dirname, '../dist'),
    prefix: '/',
  })
}

// ── WebSocket Server ──────────────────────────────────────────────────────────

const wss     = new WebSocketServer({ server: httpServer, path: '/ws' })
const clients = new Set<WebSocket>()
const world   = new World()

function broadcast(event: object): void {
  const msg = JSON.stringify(event)
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg)
  }
}

wss.on('connection', (socket) => {
  clients.add(socket)
  // Full state sync on connect
  socket.send(JSON.stringify({
    type: 'state',
    world: world.snapshot(),
    provider: getActiveProvider(),
  }))
  socket.on('close', () => clients.delete(socket))
  socket.on('error', () => clients.delete(socket))
})

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/api/health', async () => ({
  ok: true,
  name: 'NightCityVerse',
  clients: clients.size,
  provider: getActiveProvider(),
}))

app.get('/api/state', async () => world.snapshot())

// Heartbeat — called by NitroCircus API on task state changes
app.post('/api/heartbeat', {
  schema: {
    body: {
      type: 'object',
      required: ['agent', 'state'],
      properties: {
        agent: { type: 'string', minLength: 1 },
        name: { type: 'string' },
        state: { type: 'string', enum: ['idle','working','thinking','sleeping','error','offline'] },
        task: { type: 'string' },
        energy: { type: 'number', minimum: 0, maximum: 100 },
      },
      additionalProperties: false,
    },
  },
}, async (req, reply) => {
  const body = req.body as {
    agent: string
    name?: string
    state: AgentAnimState
    task?: string
    energy?: number
  }
  world.updateAgent(body)
  broadcast({ type: 'heartbeat', ...body })
  reply.code(200)
  return { ok: true }
})

// Act — called by NitroCircus API for agent actions (speak, emote, etc.)
app.post('/api/act', {
  schema: {
    body: {
      type: 'object',
      required: ['agent', 'action'],
      properties: {
        agent: { type: 'string', minLength: 1 },
        action: {
          type: 'object',
          required: ['type'],
          properties: {
            type: { type: 'string', minLength: 1 },
            message: { type: 'string' },
            state: { type: 'string', enum: ['idle','working','thinking','sleeping','error','offline'] },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
  },
}, async (req, reply) => {
  const body = req.body as {
    agent: string
    action: { type: string; message?: string; state?: AgentAnimState }
  }
  world.processAction(body)
  broadcast({ type: 'act', ...body })
  reply.code(200)
  return { ok: true }
})

// World editor — multi-provider LLM
app.post('/api/edit', {
  schema: {
    body: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', minLength: 1, maxLength: 1024 },
      },
      additionalProperties: false,
    },
  },
}, async (req, reply) => {
  const { prompt } = req.body as { prompt: string }

  const patch = await editWorldWithLLM(world.snapshot(), prompt)
  if (patch) {
    world.applyPatch(patch)
    broadcast({
      type: 'state',
      world: world.snapshot(),
      provider: getActiveProvider(),
    })
  }
  return { ok: true, message: patch?.message ?? null }
})

// Provider list — returns all providers with availability status
app.get('/api/providers', async () => {
  const statuses = await getProviderStatuses()
  return {
    active: getActiveProvider(),
    providers: statuses,
  }
})

// Provider selection — switch at runtime
app.post('/api/providers/select', {
  schema: {
    body: {
      type: 'object',
      required: ['provider'],
      properties: {
        provider: { type: 'string', enum: [...ALLOWED_PROVIDERS] },
      },
      additionalProperties: false,
    },
  },
}, async (req, reply) => {
  const { provider } = req.body as { provider: LLMProvider }
  if (!ALLOWED_PROVIDERS.includes(provider)) {
    return reply.code(400).send({ error: 'invalid provider — use: anthropic | openai | ollama' })
  }
  setActiveProvider(provider)
  broadcast({ type: 'provider', active: provider })
  return { ok: true, active: provider }
})

// ── Start ─────────────────────────────────────────────────────────────────────

await app.ready()
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ NightCityVerse running at http://localhost:${PORT}`)
  console.log(`   LLM provider: ${getActiveProvider()}`)
  if (IS_DEV) {
    console.log(`   Client dev server → npm run dev:client (port 5174)`)
  }
})
