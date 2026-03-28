import { initRenderer, setWorld }      from './renderer.js'
import { initWs, onWorldUpdate, updateStatusBar } from './ws-client.js'
import { initEditor }                  from './editor.js'

// Boot
initRenderer()
initEditor()

onWorldUpdate((world) => {
  setWorld(world)
  updateStatusBar(world.agents)
})

initWs()
