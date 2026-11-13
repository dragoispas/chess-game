import { useCallback, useState } from 'react'
import {
  createGame,
  formatResignMessage,
  formatTimeoutMessage,
  tryMove,
} from '../engine/game.ts'
import { toPosition } from '../engine/moves.ts'
import { formatMoveLabel, pieceCapturedOnMove } from '../engine/notation.ts'
import type {
  BoardSetup,
  Color,
  GameState,
  LastMove,
  Piece,
} from '../engine/types.ts'
import { Board, type BoardMoveEvent } from './Board.tsx'
import { MoveList } from './MoveList.tsx'
import type { PlayOpponent } from './PlayMenu.tsx'
import { SeatBar } from './SeatBar.tsx'
import { useStockfish, type StockfishMove } from './useStockfish.ts'
import './GameScreen.css'

function capitalize(color: string): string {
  return color.charAt(0).toUpperCase() + color.slice(1)
}

function opposite(color: Color): Color {
  return color === 'white' ? 'black' : 'white'
}

function statusMessage(
  game: GameState,
  thinking: boolean,
  opponent: PlayOpponent,
  playAs: Color,
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
  if (game.status === 'stalemate') {
    return 'Stalemate — draw.'
  }
  if (thinking) {
    return 'Stockfish is thinking…'
  }
  if (game.inCheck) {
    return `${capitalize(game.turn)} is in check.`
  }
  if (opponent === 'stockfish' && game.turn === playAs) {
    return `Your turn (${capitalize(playAs)}) — click or drag a piece to a highlighted square.`
  }
  return `Turn: ${capitalize(game.turn)} — click or drag a piece to a highlighted square.`
}

type Snapshot = {
  game: GameState
  lastMove: LastMove | null
  moves: string[]
  capturedByWhite: Piece[]
  capturedByBlack: Piece[]
}

type GameScreenProps = {
  setup: BoardSetup | null
  opponent?: PlayOpponent
  playAs?: Color
  title?: string
  backLabel?: string
  onBack: () => void
}

function initialSnapshot(setup: BoardSetup | null): Snapshot {
  return {
    game: createGame(setup ?? undefined),
    lastMove: null,
    moves: [],
    capturedByWhite: [],
    capturedByBlack: [],
  }
}

export function GameScreen({
  setup,
  opponent = 'player',
  playAs = 'white',
  title = 'Chess',
  backLabel = 'Back',
  onBack,
}: GameScreenProps) {
  const [history, setHistory] = useState<Snapshot[]>(() => [
    initialSnapshot(setup),
  ])
  const [thinking, setThinking] = useState(false)

  const current = history[history.length - 1]!
  const { game, lastMove, moves, capturedByWhite, capturedByBlack } = current
  const canUndo = history.length > 1
  const vsStockfish = opponent === 'stockfish'
  const engineColor = opposite(playAs)
  const boardInteractive =
    game.status === 'ongoing' &&
    (!vsStockfish || game.turn === playAs) &&
    !thinking

  const topColor = opposite(playAs)
  const bottomColor = playAs
  const topPieces =
    topColor === 'white' ? capturedByWhite : capturedByBlack
  const bottomPieces =
    bottomColor === 'white' ? capturedByWhite : capturedByBlack
  const topName = vsStockfish
    ? `${capitalize(topColor)} (Stockfish)`
    : capitalize(topColor)
  const bottomName = vsStockfish
    ? `${capitalize(bottomColor)} (you)`
    : capitalize(bottomColor)

  const pushMove = useCallback(
    ({ state, from, to, promotion }: BoardMoveEvent) => {
      setHistory((prev) => {
        const tip = prev[prev.length - 1]!
        const position = toPosition(tip.game)
        const label = formatMoveLabel(position, from, to, promotion)
        const captured = pieceCapturedOnMove(position, from, to)

        const nextCapturedWhite = tip.capturedByWhite.slice()
        const nextCapturedBlack = tip.capturedByBlack.slice()
        if (captured) {
          if (captured.color === 'black') nextCapturedWhite.push(captured)
          else nextCapturedBlack.push(captured)
        }

        return [
          ...prev,
          {
            game: state,
            lastMove: { from, to },
            moves: [...tip.moves, label],
            capturedByWhite: nextCapturedWhite,
            capturedByBlack: nextCapturedBlack,
          },
        ]
      })
    },
    [],
  )

  const handleStockfishMove = useCallback(
    (move: StockfishMove) => {
      setHistory((prev) => {
        const tip = prev[prev.length - 1]!
        if (tip.game.status !== 'ongoing' || tip.game.turn !== engineColor) {
          return prev
        }
        const result = tryMove(tip.game, move.from, move.to, move.promotion)
        if (result.type !== 'moved') return prev

        const position = toPosition(tip.game)
        const label = formatMoveLabel(
          position,
          move.from,
          move.to,
          move.promotion,
        )
        const captured = pieceCapturedOnMove(position, move.from, move.to)
        const nextCapturedWhite = tip.capturedByWhite.slice()
        const nextCapturedBlack = tip.capturedByBlack.slice()
        if (captured) {
          if (captured.color === 'black') nextCapturedWhite.push(captured)
          else nextCapturedBlack.push(captured)
        }

        return [
          ...prev,
          {
            game: result.state,
            lastMove: { from: move.from, to: move.to },
            moves: [...tip.moves, label],
            capturedByWhite: nextCapturedWhite,
            capturedByBlack: nextCapturedBlack,
          },
        ]
      })
    },
    [engineColor],
  )

  useStockfish({
    enabled: vsStockfish,
    game,
    engineColor,
    onMove: handleStockfishMove,
    onThinkingChange: setThinking,
  })

  function handleUndo() {
    if (!canUndo) return
    setHistory((prev) => {
      if (
        vsStockfish &&
        prev.length >= 3 &&
        prev[prev.length - 1]!.game.turn === playAs
      ) {
        return prev.slice(0, -2)
      }
      return prev.slice(0, -1)
    })
  }

  function handleNewGame() {
    setHistory([initialSnapshot(setup)])
  }

  return (
    <main className="game-screen">
      <header className="game-header">
        <div className="game-header-bar">
          <button type="button" className="reset game-back" onClick={onBack}>
            {backLabel}
          </button>
          <div className="game-header-copy">
            <h1>{title}</h1>
            <p
              className={
                game.status !== 'ongoing' || game.inCheck || thinking
                  ? 'status-alert'
                  : ''
              }
            >
              {statusMessage(game, thinking, opponent, playAs)}
            </p>
          </div>
        </div>
      </header>

      <div className="play-layout">
        <div className="board-column">
          <SeatBar name={topName} pieces={topPieces} />
          <Board
            game={game}
            lastMove={lastMove}
            interactive={boardInteractive}
            orientation={playAs}
            onMove={pushMove}
          />
          <SeatBar name={bottomName} pieces={bottomPieces} />
        </div>

        <aside className="play-sidebar">
          <MoveList moves={moves} />

          <button
            type="button"
            className="reset sidebar-action"
            disabled={!canUndo || thinking}
            onClick={handleUndo}
          >
            Undo
          </button>
          <button
            type="button"
            className="reset sidebar-action"
            onClick={handleNewGame}
          >
            New game
          </button>
        </aside>
      </div>
    </main>
  )
}
