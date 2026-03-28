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

// ── HTTP Server ───────────────────────────────────────────────────────────────

const httpServer = createServer()

const app = Fastify({
  serverFactory: (handler) => {
    httpServer.on('request', handler)
    return httpServer
  },
  logger: false,
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
app.post('/api/heartbeat', async (req, reply) => {
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
app.post('/api/act', async (req, reply) => {
  const body = req.body as {
    agent: string
    action: { type: string; message?: string; state?: string }
  }
  world.processAction(body)
  broadcast({ type: 'act', ...body })
  reply.code(200)
  return { ok: true }
})

// World editor — multi-provider LLM
app.post('/api/edit', async (req, reply) => {
  const { prompt } = req.body as { prompt?: string }
  if (!prompt) return reply.code(400).send({ error: 'prompt required' })

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
app.post('/api/providers/select', async (req, reply) => {
  const { provider } = req.body as { provider?: string }
  if (provider !== 'anthropic' && provider !== 'openai' && provider !== 'ollama') {
    return reply.code(400).send({ error: 'invalid provider — use: anthropic | openai | ollama' })
  }
  setActiveProvider(provider as LLMProvider)
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
