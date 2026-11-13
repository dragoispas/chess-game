import { useEffect, useMemo, useRef, useState } from 'react'
import {
  formatResignMessage,
  formatTimeoutMessage,
} from '../engine/game.ts'
import { toPosition } from '../engine/moves.ts'
import { formatMoveLabel, pieceCapturedOnMove } from '../engine/notation.ts'
import type {
  Color,
  GameState,
  LastMove,
  Piece,
  SquareIndex,
} from '../engine/types.ts'
import { removeActiveOnline } from '../online/activeOnline.ts'
import type { ServerMessage } from '../online/protocol.ts'
import type { ClockSnapshot } from '../online/timeControls.ts'
import { Board, type BoardMoveEvent } from './Board.tsx'
import { ClockStack } from './Clocks.tsx'
import { MoveList } from './MoveList.tsx'
import type { OnlineReady } from './OnlineLobby.tsx'
import { SeatBar } from './SeatBar.tsx'
import {
  connectionStatusLabel,
  useConnectionStatus,
} from './useConnectionStatus.ts'
import './GameScreen.css'
import './OnlineLobby.css'

function capitalize(color: string): string {
  return color.charAt(0).toUpperCase() + color.slice(1)
}

function statusMessage(
  game: GameState,
  you: Color,
  opponentConnected: boolean,
): string {
  if (game.status === 'checkmate' && game.winner) {
    return `Checkmate — ${capitalize(game.winner)} wins.`
  }
  if (game.status === 'resigned' && game.winner) {
    return formatResignMessage(game.winner)
  }
  if (game.status === 'timeout' && game.winner) {
    return formatTimeoutMessage(game.winner)
  }
  if (game.status === 'stalemate') return 'Stalemate — draw.'
  if (!opponentConnected && game.status === 'ongoing') {
    return 'Opponent disconnected — waiting for them to rejoin.'
  }
  if (game.inCheck) return `${capitalize(game.turn)} is in check.`
  if (game.turn === you) {
    return `Your turn (${capitalize(you)}).`
  }
  return `Opponent’s turn (${capitalize(game.turn)}).`
}

function useLiveClocks(snapshot: ClockSnapshot | null) {
  const [now, setNow] = useState(() => Date.now())
  const receivedAtRef = useRef(Date.now())
  const snapKey = snapshot
    ? `${snapshot.serverNow}:${snapshot.whiteMs}:${snapshot.blackMs}:${snapshot.active}`
    : ''

  useEffect(() => {
    receivedAtRef.current = Date.now()
    setNow(Date.now())
  }, [snapKey])

  useEffect(() => {
    if (!snapshot?.active) return
    const id = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(id)
  }, [snapshot?.active, snapKey])

  return useMemo(() => {
    if (!snapshot) {
      return { whiteMs: 0, blackMs: 0, active: null as Color | null }
    }
    const elapsed =
      snapshot.active != null
        ? Math.max(0, now - receivedAtRef.current)
        : 0
    return {
      whiteMs:
        snapshot.active === 'white'
          ? Math.max(0, snapshot.whiteMs - elapsed)
          : snapshot.whiteMs,
      blackMs:
        snapshot.active === 'black'
          ? Math.max(0, snapshot.blackMs - elapsed)
          : snapshot.blackMs,
      active: snapshot.active,
    }
  }, [snapshot, now])
}

type Snapshot = {
  game: GameState
  lastMove: LastMove | null
  moves: string[]
  capturedByWhite: Piece[]
  capturedByBlack: Piece[]
}

type PendingMove = {
  from: SquareIndex
  to: SquareIndex
  rollback: Snapshot
}

type OnlineGameScreenProps = {
  session: OnlineReady
  onBack: () => void
}

export function OnlineGameScreen({ session, onBack }: OnlineGameScreenProps) {
  const { socket, you, code } = session
  const [game, setGame] = useState<GameState>(session.state)
  const [lastMove, setLastMove] = useState<LastMove | null>(session.lastMove)
  const [moves, setMoves] = useState<string[]>(session.moves)
  const [capturedByWhite, setCapturedByWhite] = useState<Piece[]>(
    session.capturedByWhite,
  )
  const [capturedByBlack, setCapturedByBlack] = useState<Piece[]>(
    session.capturedByBlack,
  )
  const [error, setError] = useState<string | null>(null)
  const [clock, setClock] = useState<ClockSnapshot>(session.clock)
  const [seats, setSeats] = useState(session.seats)
  const live = useLiveClocks(clock)
  const pendingRef = useRef<PendingMove | null>(null)
  const [moveInFlight, setMoveInFlight] = useState(false)
  const connectionStatus = useConnectionStatus(socket)
  const connectionLabel = connectionStatusLabel(connectionStatus)
  const linked = connectionStatus === 'connected'
  const opponentConnected =
    you === 'white' ? seats.blackConnected : seats.whiteConnected

  function applySnapshot(snap: Snapshot) {
    setGame(snap.game)
    setLastMove(snap.lastMove)
    setMoves(snap.moves)
    setCapturedByWhite(snap.capturedByWhite)
    setCapturedByBlack(snap.capturedByBlack)
  }

  function clearPending() {
    pendingRef.current = null
    setMoveInFlight(false)
  }

  useEffect(() => {
    socket.setResumeRoom(code)
  }, [socket, code])

  useEffect(() => {
    if (session.state.status !== 'ongoing') {
      removeActiveOnline(code)
    }
  }, [session.state.status, code])

  useEffect(() => {
    if (linked) return
    const pending = pendingRef.current
    if (!pending) return
    applySnapshot(pending.rollback)
    clearPending()
  }, [linked])

  useEffect(() => {
    return socket.subscribe((message: ServerMessage) => {
      if (message.type === 'error') {
        const pending = pendingRef.current
        if (pending) {
          applySnapshot(pending.rollback)
          clearPending()
        }
        setError(message.message)
        return
      }
      if (message.type === 'state') {
        setError(null)
        setClock(message.clock)
        setSeats(message.seats)
        if (message.state.status !== 'ongoing') {
          removeActiveOnline(code)
        }

        const pending = pendingRef.current
        const confirmsPending =
          pending != null &&
          message.lastMove != null &&
          message.lastMove.from === pending.from &&
          message.lastMove.to === pending.to

        if (confirmsPending) {
          clearPending()
          setGame(message.state)
          setLastMove(message.lastMove)
          if (message.moveLabel) {
            setMoves((prev) =>
              prev.length === 0
                ? [message.moveLabel!]
                : [...prev.slice(0, -1), message.moveLabel!],
            )
          }
          return
        }

        // Opponent move (or any non-pending update): apply from pre-move board.
        if (message.lastMove) {
          setGame((prev) => {
            const position = toPosition(prev)
            const label =
              message.moveLabel ??
              formatMoveLabel(
                position,
                message.lastMove!.from,
                message.lastMove!.to,
              )
            const captured = pieceCapturedOnMove(
              position,
              message.lastMove!.from,
              message.lastMove!.to,
            )
            setMoves((m) => [...m, label])
            if (captured) {
              if (captured.color === 'black') {
                setCapturedByWhite((c) => [...c, captured])
              } else {
                setCapturedByBlack((c) => [...c, captured])
              }
            }
            return message.state
          })
          setLastMove(message.lastMove)
        } else {
          setGame(message.state)
          setLastMove(message.lastMove)
        }
        return
      }
      if (message.type === 'room:ready' && !message.waiting) {
        clearPending()
        setGame(message.state)
        setClock(message.clock)
        setSeats(message.seats)
        setLastMove(message.lastMove)
        setMoves(message.moves)
        if (message.state.status !== 'ongoing') {
          removeActiveOnline(code)
        }
      }
    })
  }, [socket, code])

  const boardInteractive = useMemo(
    () =>
      linked &&
      game.status === 'ongoing' &&
      game.turn === you &&
      !moveInFlight,
    [linked, game.status, game.turn, you, moveInFlight],
  )

  const topColor: Color = you === 'white' ? 'black' : 'white'
  const bottomColor: Color = you

  function handleMove({ state, from, to, promotion }: BoardMoveEvent) {
    if (pendingRef.current || moveInFlight) return

    const rollback: Snapshot = {
      game,
      lastMove,
      moves,
      capturedByWhite,
      capturedByBlack,
    }
    pendingRef.current = { from, to, rollback }
    setMoveInFlight(true)

    const position = toPosition(game)
    const label = formatMoveLabel(position, from, to, promotion)
    const captured = pieceCapturedOnMove(position, from, to)

    setGame(state)
    setLastMove({ from, to })
    setMoves((m) => [...m, label])
    if (captured) {
      if (captured.color === 'black') {
        setCapturedByWhite((c) => [...c, captured])
      } else {
        setCapturedByBlack((c) => [...c, captured])
      }
    }

    socket.send({ type: 'move', from, to, promotion })
  }

  function handleResign() {
    if (game.status !== 'ongoing') return
    socket.send({ type: 'resign' })
  }

  function handleBack() {
    socket.send({ type: 'room:leave' })
    socket.close()
    onBack()
  }

  return (
    <main className="game-screen">
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
            <h1>
              Online {session.mode === 'draft' ? 'Draft' : 'Blind'} — {code}{' '}
              <span className="clock-tc">({clock.timeControl})</span>
            </h1>
            <p
              className={
                game.status !== 'ongoing' ||
                game.inCheck ||
                error ||
                connectionLabel ||
                !opponentConnected
                  ? 'status-alert'
                  : ''
              }
            >
              {connectionLabel ??
                error ??
                statusMessage(game, you, opponentConnected)}
            </p>
          </div>
        </div>
      </header>

      <div className="play-layout">
        <div className="board-column">
          <SeatBar
            name={`${capitalize(topColor)}${topColor === you ? ' (you)' : ''}${
              (topColor === 'white'
                ? seats.whiteConnected
                : seats.blackConnected)
                ? ''
                : ' — disconnected'
            }`}
            pieces={topColor === 'white' ? capturedByWhite : capturedByBlack}
          />
          <Board
            game={game}
            lastMove={lastMove}
            interactive={boardInteractive}
            orientation={you}
            onMove={handleMove}
          />
          <SeatBar
            name={`${capitalize(bottomColor)}${bottomColor === you ? ' (you)' : ''}${
              (bottomColor === 'white'
                ? seats.whiteConnected
                : seats.blackConnected)
                ? ''
                : ' — disconnected'
            }`}
            pieces={
              bottomColor === 'white' ? capturedByWhite : capturedByBlack
            }
          />
        </div>

        <aside className="play-sidebar">
          <ClockStack
            whiteMs={live.whiteMs}
            blackMs={live.blackMs}
            active={live.active}
            timeControl={clock.timeControl}
            topColor={topColor}
            bottomColor={bottomColor}
          />

          <MoveList moves={moves} />

          <button
            type="button"
            className="reset sidebar-resign"
            disabled={!linked || game.status !== 'ongoing'}
            onClick={handleResign}
          >
            Resign
          </button>
        </aside>
      </div>
    </main>
  )
}
