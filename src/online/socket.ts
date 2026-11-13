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

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'

type Listener = (message: ServerMessage) => void
type ConnectionListener = (status: ConnectionStatus) => void

export type OnlineSocket = {
  send: (message: ClientMessage) => void
  subscribe: (listener: Listener) => () => void
  subscribeConnection: (listener: ConnectionListener) => () => void
  /** Room to rejoin automatically after a successful hello (reconnect). */
  setResumeRoom: (code: string | null) => void
  close: () => void
  readonly ready: Promise<void>
  getStatus: () => ConnectionStatus
}

export function connectOnlineSocket(): OnlineSocket {
  const messageListeners = new Set<Listener>()
  const connectionListeners = new Set<ConnectionListener>()

  let ws: WebSocket | null = null
  let status: ConnectionStatus = 'connecting'
  let intentionalClose = false
  let resumeCode: string | null = null
  let reconnectAttempt = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  let readySettled = false
  let resolveReady!: () => void
  let rejectReady!: (err: Error) => void
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })

  function setStatus(next: ConnectionStatus) {
    if (status === next) return
    status = next
    for (const listener of connectionListeners) listener(next)
  }

  function clearReconnectTimer() {
    if (reconnectTimer == null) return
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  function scheduleReconnect() {
    if (intentionalClose) return
    clearReconnectTimer()
    setStatus('reconnecting')
    const delay = Math.min(10_000, 500 * 2 ** reconnectAttempt)
    reconnectAttempt += 1
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      openSocket()
    }, delay)
  }

  function openSocket() {
    if (intentionalClose) return
    if (
      ws &&
      (ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    setStatus(reconnectAttempt > 0 ? 'reconnecting' : 'connecting')
    const socket = new WebSocket(wsUrl())
    ws = socket

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
        if (message.type === 'hello:ok') {
          reconnectAttempt = 0
          setStatus('connected')
          if (!readySettled) {
            readySettled = true
            resolveReady()
          }
          if (resumeCode && socket.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({
                type: 'room:join',
                code: resumeCode,
              } satisfies ClientMessage),
            )
          }
        }
        for (const listener of messageListeners) listener(message)
      } catch {
        /* ignore malformed */
      }
    })

    socket.addEventListener('close', () => {
      if (ws === socket) ws = null
      if (intentionalClose) {
        setStatus('disconnected')
        return
      }
      setStatus('disconnected')
      scheduleReconnect()
    })

    socket.addEventListener('error', () => {
      if (!readySettled && reconnectAttempt === 0) {
        // First connection failed — keep trying via close → reconnect,
        // but surface a soft failure for the lobby after a short wait.
      }
    })
  }

  function onBrowserOnline() {
    if (intentionalClose) return
    if (status === 'connected') return
    clearReconnectTimer()
    reconnectAttempt = 0
    openSocket()
  }

  window.addEventListener('online', onBrowserOnline)
  openSocket()

  // If the first connect never succeeds, reject ready after a few seconds
  // so the lobby can show an error — reconnect still continues in background.
  window.setTimeout(() => {
    if (!readySettled && !intentionalClose) {
      readySettled = true
      rejectReady(new Error('WebSocket connection failed'))
    }
  }, 8_000)

  return {
    ready,
    getStatus: () => status,
    setResumeRoom(code) {
      resumeCode = code ? code.trim().toUpperCase() : null
    },
    send(message) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message))
      }
    },
    subscribe(listener) {
      messageListeners.add(listener)
      return () => {
        messageListeners.delete(listener)
      }
    },
    subscribeConnection(listener) {
      connectionListeners.add(listener)
      listener(status)
      return () => {
        connectionListeners.delete(listener)
      }
    },
    close() {
      intentionalClose = true
      clearReconnectTimer()
      window.removeEventListener('online', onBrowserOnline)
      messageListeners.clear()
      connectionListeners.clear()
      resumeCode = null
      if (ws) {
        ws.close()
        ws = null
      }
      setStatus('disconnected')
    },
  }
}
