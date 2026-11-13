import { getPlayerId } from './playerId.ts'
import type { ClientMessage, ServerMessage } from './protocol.ts'

export function wsUrl(): string {
  const configured = import.meta.env.VITE_WS_URL as string | undefined
  if (configured) return configured
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  // Dev server proxies /ws → :3001; production can point VITE_WS_URL.
  if (import.meta.env.DEV) {
    return `${protocol}//${location.hostname}:3001`
  }
  return `${protocol}//${location.host}/ws`
}

type Listener = (message: ServerMessage) => void

export type OnlineSocket = {
  send: (message: ClientMessage) => void
  subscribe: (listener: Listener) => () => void
  close: () => void
  readonly ready: Promise<void>
}

export function connectOnlineSocket(): OnlineSocket {
  const socket = new WebSocket(wsUrl())
  const listeners = new Set<Listener>()
  let opened: () => void
  let failed: (err: Error) => void
  const ready = new Promise<void>((resolve, reject) => {
    opened = resolve
    failed = reject
  })

  socket.addEventListener('open', () => {
    socket.send(
      JSON.stringify({
        type: 'hello',
        playerId: getPlayerId(),
      } satisfies ClientMessage),
    )
  })

  socket.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(String(event.data)) as ServerMessage
      if (message.type === 'hello:ok') opened()
      for (const listener of listeners) listener(message)
    } catch {
      /* ignore malformed */
    }
  })

  socket.addEventListener('error', () => {
    failed(new Error('WebSocket connection failed'))
  })

  return {
    ready,
    send(message) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message))
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    close() {
      listeners.clear()
      socket.close()
    },
  }
}
