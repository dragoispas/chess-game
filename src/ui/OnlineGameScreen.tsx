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
} from '../engine/types.ts'
import { removeActiveOnline } from '../online/activeOnline.ts'
import type { ServerMessage } from '../online/protocol.ts'
import type { ClockSnapshot } from '../online/timeControls.ts'
import { Board, type BoardMoveEvent } from './Board.tsx'
import { ClockStack } from './Clocks.tsx'
import { MoveList } from './MoveList.tsx'
import type { OnlineReady } from './OnlineLobby.tsx'
import { SeatBar } from './SeatBar.tsx'
import './GameScreen.css'

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
  const opponentConnected =
    you === 'white' ? seats.blackConnected : seats.whiteConnected

  useEffect(() => {
    if (session.state.status !== 'ongoing') {
      removeActiveOnline(code)
    }
  }, [session.state.status, code])

  useEffect(() => {
    return socket.subscribe((message: ServerMessage) => {
      if (message.type === 'error') {
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
        setGame((prev) => {
          if (message.lastMove) {
            const position = toPosition(prev)
            const label =
              message.moveLabel ??
              formatMoveLabel(
                position,
                message.lastMove.from,
                message.lastMove.to,
              )
            const captured = pieceCapturedOnMove(
              position,
              message.lastMove.from,
              message.lastMove.to,
            )
            queueMicrotask(() => {
              setMoves((m) => [...m, label])
              if (captured) {
                if (captured.color === 'black') {
                  setCapturedByWhite((c) => [...c, captured])
                } else {
                  setCapturedByBlack((c) => [...c, captured])
                }
              }
            })
          }
          return message.state
        })
        setLastMove(message.lastMove)
      }
      if (message.type === 'room:ready' && !message.waiting) {
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

  const interactive = useMemo(
    () => game.status === 'ongoing' && game.turn === you,
    [game.status, game.turn, you],
  )

  const topColor: Color = you === 'white' ? 'black' : 'white'
  const bottomColor: Color = you

  function handleMove({ from, to, promotion }: BoardMoveEvent) {
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
                !opponentConnected
                  ? 'status-alert'
                  : ''
              }
            >
              {error ?? statusMessage(game, you, opponentConnected)}
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
            interactive={interactive}
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
            disabled={game.status !== 'ongoing'}
            onClick={handleResign}
          >
            Resign
          </button>
        </aside>
      </div>
    </main>
  )
}
