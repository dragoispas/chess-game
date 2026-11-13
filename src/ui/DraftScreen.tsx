import { useMemo, useState, type CSSProperties } from 'react'
import {
  CLASSIC_PIECES,
  draftBudgetForSize,
  EXPANSION_PIECES,
  isDraftSquare,
  pieceCost,
} from '../engine/catalog.ts'
import {
  emptySetup,
  initialCastlingUnmoved,
  placePiece,
  setupIssueMessage,
  standardHalfBoard,
  validateSetup,
} from '../engine/setup.ts'
import type {
  Board,
  BoardSetup,
  BoardSize,
  Color,
  PieceType,
  SquareIndex,
} from '../engine/types.ts'
import { fileRankToIndex, indexToFileRank } from '../shared/coords.ts'
import { Piece as PieceView } from './Piece.tsx'
import type { PlayOpponent } from './PlayMenu.tsx'
import { pieceSprites } from './pieces.ts'
import './Board.css'
import './EditorScreen.css'
import './DraftScreen.css'

type DraftPhase = 'white' | 'handoff' | 'black'

type DraftScreenProps = {
  size: BoardSize
  opponent?: PlayOpponent
  /** Color the local / human player builds (and sits as after start). */
  playAs?: Color
  onStart: (setup: BoardSetup) => void
}

type PaletteSelection = PieceType | 'erase'

function spentOnBoard(board: Board, color: Color): number {
  let spent = 0
  for (const piece of board) {
    if (piece && piece.color === color) spent += pieceCost(piece.type)
  }
  return spent
}

function countKings(board: Board, color: Color): number {
  let n = 0
  for (const piece of board) {
    if (piece && piece.type === 'king' && piece.color === color) n += 1
  }
  return n
}

function mergeDraftBoards(
  whiteBoard: Board,
  blackBoard: Board,
  size: BoardSize,
): BoardSetup {
  const board = emptySetup(size).board
  for (let i = 0; i < board.length; i++) {
    if (isDraftSquare('white', i, size) && whiteBoard[i]) {
      board[i] = whiteBoard[i]
    }
    if (isDraftSquare('black', i, size) && blackBoard[i]) {
      board[i] = blackBoard[i]
    }
  }
  return {
    board,
    size,
    turn: 'white',
    castling: initialCastlingUnmoved(board),
    enPassant: null,
  }
}

function boardSquares(size: BoardSize, orientation: Color): SquareIndex[] {
  const list: SquareIndex[] = []
  if (orientation === 'white') {
    for (let rank = size - 1; rank >= 0; rank--) {
      for (let file = 0; file < size; file++) {
        list.push(fileRankToIndex(file, rank, size))
      }
    }
  } else {
    for (let rank = 0; rank < size; rank++) {
      for (let file = size - 1; file >= 0; file--) {
        list.push(fileRankToIndex(file, rank, size))
      }
    }
  }
  return list
}

function opposite(color: Color): Color {
  return color === 'white' ? 'black' : 'white'
}

export function DraftScreen({
  size,
  opponent = 'player',
  playAs = 'white',
  onStart,
}: DraftScreenProps) {
  const vsStockfish = opponent === 'stockfish'
  const budget = draftBudgetForSize(size)
  const [phase, setPhase] = useState<DraftPhase>(playAs)
  const [whiteBoard, setWhiteBoard] = useState<Board>(() =>
    vsStockfish ? standardHalfBoard('white', size) : emptySetup(size).board,
  )
  const [blackBoard, setBlackBoard] = useState<Board>(() =>
    vsStockfish ? standardHalfBoard('black', size) : emptySetup(size).board,
  )
  const [selected, setSelected] = useState<PaletteSelection>('king')
  const [mergeIssues, setMergeIssues] = useState<string[]>([])

  const color: Color = phase === 'black' ? 'black' : 'white'
  const activeBoard = phase === 'black' ? blackBoard : whiteBoard
  const setActiveBoard = phase === 'black' ? setBlackBoard : setWhiteBoard
  const stockfishSide = opposite(playAs)
  const stockfishSideLabel = stockfishSide === 'white' ? 'White' : 'Black'

  const spent = spentOnBoard(activeBoard, color)
  const remaining = budget - spent
  const kings = countKings(activeBoard, color)
  const canConfirm = kings === 1 && remaining >= 0

  const displayBoard = useMemo(() => {
    if (vsStockfish) {
      return mergeDraftBoards(whiteBoard, blackBoard, size).board
    }
    if (phase === 'white' || phase === 'handoff') {
      if (phase === 'handoff' && playAs === 'black') {
        const board = emptySetup(size).board
        for (let i = 0; i < board.length; i++) {
          if (isDraftSquare('black', i, size) && blackBoard[i]) {
            board[i] = blackBoard[i]
          }
        }
        return board
      }
      return whiteBoard
    }
    const board = emptySetup(size).board
    for (let i = 0; i < board.length; i++) {
      if (isDraftSquare('black', i, size) && blackBoard[i]) {
        board[i] = blackBoard[i]
      }
    }
    return board
  }, [phase, whiteBoard, blackBoard, size, playAs, vsStockfish])

  function handleSquareClick(square: SquareIndex) {
    if (phase === 'handoff') return
    if (!isDraftSquare(color, square, size)) return

    if (selected === 'erase') {
      setActiveBoard((prev) => placePiece(prev, square, null))
      return
    }

    const cost = pieceCost(selected)
    const existing = activeBoard[square]
    const refund =
      existing && existing.color === color ? pieceCost(existing.type) : 0
    if (cost - refund > remaining) return

    if (selected === 'king' && kings >= 1 && existing?.type !== 'king') return

    setActiveBoard((prev) =>
      placePiece(prev, square, { type: selected, color }),
    )
  }

  function finishWithBoards(nextWhite: Board, nextBlack: Board) {
    const setup = mergeDraftBoards(nextWhite, nextBlack, size)
    const issues = validateSetup(setup)
    if (issues.length > 0) {
      setMergeIssues(issues.map(setupIssueMessage))
      return
    }
    setMergeIssues([])
    onStart(setup)
  }

  function handleConfirm() {
    if (!canConfirm) return
    if (vsStockfish) {
      // Stockfish keeps the standard half; only the human side was edited.
      const stockfishHalf = standardHalfBoard(stockfishSide, size)
      if (playAs === 'white') {
        finishWithBoards(whiteBoard, stockfishHalf)
      } else {
        finishWithBoards(stockfishHalf, blackBoard)
      }
      return
    }

    if (phase === playAs) {
      setSelected('king')
      setMergeIssues([])
      setPhase('handoff')
      return
    }
    finishWithBoards(whiteBoard, blackBoard)
  }

  if (phase === 'handoff') {
    const lockedLabel = playAs === 'white' ? 'White' : 'Black'
    const nextLabel = playAs === 'white' ? 'Black' : 'White'
    return (
      <main className="draft-screen">
        <header className="game-header">
          <h1>Point Draft</h1>
          <p>{lockedLabel}’s army is locked in.</p>
        </header>
        <div className="draft-handoff">
          <p className="draft-handoff-title">Pass the device to {nextLabel}</p>
          <p>Don’t peek — {nextLabel} builds blindly next.</p>
          <button
            type="button"
            className="reset primary"
            onClick={() => setPhase(opposite(playAs))}
          >
            {nextLabel} is ready
          </button>
        </div>
      </main>
    )
  }

  const sideLabel = color === 'white' ? 'White' : 'Black'
  const squares = boardSquares(size, color)

  return (
    <main className="draft-screen">
      <header className="game-header">
        <h1>Point Draft — {sideLabel}</h1>
        <p>
          {vsStockfish
            ? `Starts from a standard board. Customize your half (budget ${budget}). Stockfish keeps the standard ${stockfishSideLabel} army.`
            : `Place pieces on your half of the board. Budget ${budget} points. You need exactly one king.`}
        </p>
      </header>

      <div className="draft-budget" aria-live="polite">
        <span>
          Remaining: <strong>{remaining}</strong>
        </span>
        <span>
          Spent: <strong>{spent}</strong>
        </span>
        <span>
          Kings: <strong>{kings}</strong>
        </span>
      </div>

      <div className="draft-layout">
        <div
          className="palette draft-palette"
          role="toolbar"
          aria-label="Draft palette"
        >
          <section className="palette-section" aria-label="Classic">
            <p className="palette-section-label">Classic</p>
            <DraftPaletteRow
              color={color}
              types={CLASSIC_PIECES}
              selected={selected}
              remaining={remaining}
              onSelect={setSelected}
            />
          </section>
          <section className="palette-section" aria-label="Expansion">
            <p className="palette-section-label">Expansion</p>
            <DraftPaletteRow
              color={color}
              types={EXPANSION_PIECES}
              selected={selected}
              remaining={remaining}
              onSelect={setSelected}
            />
          </section>
          <button
            type="button"
            className={[
              'palette-item',
              'eraser',
              selected === 'erase' ? 'active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setSelected('erase')}
            aria-pressed={selected === 'erase'}
          >
            Erase
          </button>
        </div>

        <div
          className="board draft-board"
          role="grid"
          aria-label={`${sideLabel} draft board`}
          style={{ '--board-size': size } as CSSProperties}
        >
          {squares.map((square) => {
            const { file, rank } = indexToFileRank(square, size)
            const light = (file + rank) % 2 === 1
            const own = isDraftSquare(color, square, size)
            const fogged =
              phase !== playAs && isDraftSquare(playAs, square, size)
            const piece = displayBoard[square]

            return (
              <button
                key={square}
                type="button"
                disabled={!own}
                className={[
                  'square',
                  light ? 'light' : 'dark',
                  own ? 'draft-own' : 'draft-other',
                  fogged ? 'draft-fog' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleSquareClick(square)}
                aria-label={`Square ${String.fromCharCode(97 + file)}${rank + 1}`}
              >
                {fogged ? null : piece ? <PieceView piece={piece} /> : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="draft-actions">
        <button
          type="button"
          className="reset"
          onClick={() => setActiveBoard(emptySetup(size).board)}
        >
          Clear my half
        </button>
        <button
          type="button"
          className="reset primary"
          disabled={!canConfirm}
          onClick={handleConfirm}
        >
          {opponent === 'stockfish'
            ? 'Confirm & play Stockfish'
            : phase === playAs
              ? `Confirm ${sideLabel}`
              : 'Confirm & start'}
        </button>
      </div>

      {!canConfirm ? (
        <p className="draft-hint">
          {kings === 0
            ? 'Place exactly one king to continue.'
            : kings > 1
              ? 'Only one king allowed.'
              : remaining < 0
                ? 'Over budget — remove pieces.'
                : null}
        </p>
      ) : null}

      {mergeIssues.length > 0 ? (
        <ul className="setup-issues">
          {mergeIssues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
    </main>
  )
}

function DraftPaletteRow({
  color,
  types,
  selected,
  remaining,
  onSelect,
}: {
  color: Color
  types: { id: PieceType; name: string; cost: number; blurb: string }[]
  selected: PaletteSelection
  remaining: number
  onSelect: (value: PaletteSelection) => void
}) {
  return (
    <div className="palette-row draft-palette-row">
      {types.map((entry) => {
        const active = selected === entry.id
        const unaffordable = entry.cost > remaining && entry.id !== 'king'
        return (
          <button
            key={entry.id}
            type="button"
            className={[
              'palette-item',
              'draft-piece',
              active ? 'active' : '',
              unaffordable ? 'unaffordable' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelect(entry.id)}
            aria-pressed={active}
            aria-label={`${entry.name}, ${entry.cost} points`}
            title={`${entry.name} — ${entry.blurb} (${entry.cost} pts)`}
            disabled={unaffordable && !active}
          >
            <img
              src={pieceSprites[color][entry.id]}
              alt=""
              draggable={false}
            />
            <span className="draft-cost">{entry.cost}</span>
          </button>
        )
      })}
    </div>
  )
}
