import { useEffect, useRef, useState } from 'react'
import type {
  Board,
  BoardSetup,
  BoardSize,
  Color,
  GameState,
  LastMove,
  Piece,
} from '../engine/types.ts'
import { boardSizeLabel } from '../engine/notation.ts'
import {
  clearActiveOnline,
  removeActiveOnline,
  setActiveOnline,
} from '../online/activeOnline.ts'
import { connectOnlineSocket, type OnlineSocket } from '../online/socket.ts'
import type {
  OnlineGameMode,
  ServerMessage,
} from '../online/protocol.ts'
import { rebuildCapturesFromPlies } from '../online/rebuildCaptures.ts'
import type { ClockSnapshot, TimeControlId } from '../online/timeControls.ts'
import './PlayMenu.css'
import './OnlineLobby.css'

export type OnlineReady = {
  socket: OnlineSocket
  code: string
  gameId: string
  mode: OnlineGameMode
  setup: BoardSetup
  state: GameState
  you: Color
  clock: ClockSnapshot
  lastMove: LastMove | null
  moves: string[]
  capturedByWhite: Piece[]
  capturedByBlack: Piece[]
  seats: { whiteConnected: boolean; blackConnected: boolean }
}

export type OnlineDraftReady = {
  socket: OnlineSocket
  code: string
  gameId: string
  you: Color
  size: BoardSize
  budget: number
  timeControl: TimeControlId
  board: Board
  youReady: boolean
  opponentReady: boolean
  seats: { whiteConnected: boolean; blackConnected: boolean }
}

export type OnlineLobbyIntent =
  | {
      action: 'create'
      size: BoardSize
      timeControl: TimeControlId
      mode: OnlineGameMode
      preferredColor: Color
    }
  | { action: 'join'; code: string }

type OnlineLobbyProps = {
  intent: OnlineLobbyIntent
  onReady: (session: OnlineReady) => void
  onDraft: (session: OnlineDraftReady) => void
  onBack: () => void
}

export function sessionFromReady(
  connection: OnlineSocket,
  message: Extract<ServerMessage, { type: 'room:ready' }>,
): OnlineReady {
  const { capturedByWhite, capturedByBlack } = rebuildCapturesFromPlies(
    message.setup,
    message.plies,
  )
  return {
    socket: connection,
    code: message.code,
    gameId: message.gameId,
    mode: message.mode,
    setup: message.setup,
    state: message.state,
    you: message.you,
    clock: message.clock,
    lastMove: message.lastMove,
    moves: message.moves,
    capturedByWhite,
    capturedByBlack,
    seats: message.seats,
  }
}

function sessionFromDraft(
  connection: OnlineSocket,
  message: Extract<ServerMessage, { type: 'draft:state' }>,
): OnlineDraftReady {
  return {
    socket: connection,
    code: message.code,
    gameId: message.gameId,
    you: message.you,
    size: message.size,
    budget: message.budget,
    timeControl: message.timeControl,
    board: message.board,
    youReady: message.youReady,
    opponentReady: message.opponentReady,
    seats: message.seats,
  }
}

export function OnlineLobby({
  intent,
  onReady,
  onDraft,
  onBack,
}: OnlineLobbyProps) {
  const [status, setStatus] = useState('Connecting…')
  const [code, setCode] = useState<string | null>(
    intent.action === 'join' ? intent.code : null,
  )
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const socketRef = useRef<OnlineSocket | null>(null)
  const onReadyRef = useRef(onReady)
  const onDraftRef = useRef(onDraft)
  const handedOffRef = useRef(false)
  const startedRef = useRef(false)
  /** Only accept ready/draft for this code after create/join ack. */
  const acceptedCodeRef = useRef<string | null>(
    intent.action === 'join' ? intent.code.trim().toUpperCase() : null,
  )

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    onDraftRef.current = onDraft
  }, [onDraft])

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const connection = connectOnlineSocket()
    socketRef.current = connection
    let cancelled = false
    handedOffRef.current = false
    startedRef.current = false
    acceptedCodeRef.current =
      intent.action === 'join' ? intent.code.trim().toUpperCase() : null

    if (intent.action === 'join') {
      connection.setResumeRoom(intent.code)
    }

    const unsubConnection = connection.subscribeConnection((connStatus) => {
      if (cancelled || handedOffRef.current) return
      if (connStatus === 'reconnecting' || connStatus === 'disconnected') {
        setStatus('Connection lost — reconnecting…')
      } else if (connStatus === 'connecting' && !startedRef.current) {
        setStatus('Connecting…')
      }
    })

    void connection.ready
      .then(() => {
        if (cancelled || startedRef.current) return
        startedRef.current = true
        if (intent.action === 'create') {
          setStatus('Creating room…')
          connection.send({
            type: 'room:create',
            size: intent.size,
            timeControl: intent.timeControl,
            mode: intent.mode,
            preferredColor: intent.preferredColor,
          })
        } else {
          setStatus(`Joining ${intent.code}…`)
          connection.send({ type: 'room:join', code: intent.code })
        }
      })
      .catch(() => {
        if (!cancelled && !handedOffRef.current) {
          setStatus('Could not reach the game server — retrying…')
          setError(
            'Check your connection. If developing locally, run npm run dev (or the API).',
          )
        }
      })

    const unsubscribe = connection.subscribe((message: ServerMessage) => {
      if (message.type === 'error') {
        if (message.code === 'game_over' || message.code === 'room_not_found') {
          if (intent.action === 'join') removeActiveOnline(intent.code)
          else clearActiveOnline()
        } else if (intent.action === 'join') {
          removeActiveOnline(intent.code)
        }
        setError(message.message)
        return
      }
      if (message.type === 'room:created') {
        acceptedCodeRef.current = message.code
        connection.setResumeRoom(message.code)
        setCode(message.code)
        setActiveOnline({ code: message.code })
        setStatus(
          `Room ${message.code} (${message.mode}, ${message.timeControl}) — waiting for opponent…`,
        )
        setError(null)
        return
      }
      if (message.type === 'room:joined') {
        acceptedCodeRef.current = message.code
        connection.setResumeRoom(message.code)
        setCode(message.code)
        setActiveOnline({ code: message.code })
        setStatus(`Joined ${message.code}`)
        setError(null)
        return
      }
      if (message.type === 'draft:state') {
        if (
          !acceptedCodeRef.current ||
          message.code !== acceptedCodeRef.current
        ) {
          return
        }
        setCode(message.code)
        setActiveOnline({ code: message.code })
        setError(null)
        if (message.waiting) {
          setStatus(
            `Room ${message.code} (${message.timeControl}) — waiting for opponent…`,
          )
          return
        }
        handedOffRef.current = true
        onDraftRef.current(sessionFromDraft(connection, message))
        return
      }
      if (message.type === 'room:ready') {
        if (
          !acceptedCodeRef.current ||
          message.code !== acceptedCodeRef.current
        ) {
          return
        }
        setCode(message.code)
        setActiveOnline({ code: message.code })
        if (message.waiting) {
          setStatus(
            `Room ${message.code} (${message.mode}, ${message.clock.timeControl}) — waiting for opponent…`,
          )
          return
        }
        handedOffRef.current = true
        onReadyRef.current(sessionFromReady(connection, message))
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
      unsubConnection()
      if (!handedOffRef.current) {
        connection.send({ type: 'room:leave' })
        connection.close()
      }
    }
  }, [intent])

  function handleBack() {
    socketRef.current?.send({ type: 'room:leave' })
    socketRef.current?.close()
    if (code) removeActiveOnline(code)
    onBack()
  }

  async function handleCopyCode() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const modeLabel =
    intent.action === 'create'
      ? intent.mode === 'draft'
        ? 'Draft'
        : 'Blind'
      : 'game'
  const subtitle =
    intent.action === 'create'
      ? `${boardSizeLabel(intent.size)} · ${intent.timeControl}`
      : `Joining ${intent.code}`

  return (
    <main className="play-menu online-lobby">
      <header className="game-header">
        <div className="game-header-bar">
          <button
            type="button"
            className="reset game-back"
            onClick={handleBack}
          >
            Back
          </button>
          <div className="game-header-copy">
            <h1>Online {modeLabel}</h1>
            <p>{subtitle}</p>
          </div>
        </div>
      </header>

      <p className="online-status" aria-live="polite">
        {status}
      </p>
      {code ? (
        <div className="online-code-row">
          <p className="online-code">
            Code: <strong>{code}</strong>
          </p>
          <button
            type="button"
            className="reset"
            onClick={() => void handleCopyCode()}
            aria-label={copied ? 'Copied' : `Copy room code ${code}`}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      ) : null}
      {error ? <p className="online-error">{error}</p> : null}
    </main>
  )
}
