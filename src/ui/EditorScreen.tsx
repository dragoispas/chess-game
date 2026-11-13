import { useMemo, useState, type CSSProperties } from 'react'
import { CLASSIC_PIECES, EXPANSION_PIECES } from '../engine/catalog.ts'
import { boardSizeLabel } from '../engine/notation.ts'
import {
  classicSetup,
  emptySetup,
  initialCastlingUnmoved,
  placePiece,
  setupIssueMessage,
  validateSetup,
} from '../engine/setup.ts'
import type {
  BoardSetup,
  BoardSize,
  Color,
  Piece,
  PieceType,
  SquareIndex,
} from '../engine/types.ts'
import { BOARD_SIZES, fileRankToIndex, indexToFileRank } from '../shared/coords.ts'
import { Piece as PieceView } from './Piece.tsx'
import { pieceSprites } from './pieces.ts'
import './Board.css'
import './EditorScreen.css'

type PaletteSelection = Piece | 'erase'

type EditorScreenProps = {
  initialSetup: BoardSetup
  onPlay: (setup: BoardSetup) => void
  onBack: () => void
}

export function EditorScreen({
  initialSetup,
  onPlay,
  onBack,
}: EditorScreenProps) {
  const [setup, setSetup] = useState<BoardSetup>(() => ({
    ...initialSetup,
    board: initialSetup.board.slice(),
    castling: initialSetup.castling.slice(),
    turn: 'white',
  }))
  const [selected, setSelected] = useState<PaletteSelection>({
    type: 'pawn',
    color: 'white',
  })
  const [mirror, setMirror] = useState(true)

  const issues = useMemo(() => validateSetup(setup), [setup])
  const canPlay = issues.length === 0
  const { size } = setup

  function updateBoard(board: BoardSetup['board']) {
    setSetup((prev) => ({
      ...prev,
      board,
      castling: initialCastlingUnmoved(board),
      enPassant: null,
    }))
  }

  function handleSizeChange(nextSize: BoardSize) {
    if (nextSize === setup.size) return
    setSetup(emptySetup(nextSize))
  }

  function mirroredSquare(square: SquareIndex): SquareIndex {
    const { file, rank } = indexToFileRank(square, size)
    return fileRankToIndex(file, size - 1 - rank, size)
  }

  function handleSquareClick(square: SquareIndex) {
    let board = setup.board

    if (selected === 'erase') {
      board = placePiece(board, square, null)
      if (mirror) {
        board = placePiece(board, mirroredSquare(square), null)
      }
      updateBoard(board)
      return
    }

    board = placePiece(board, square, selected)
    if (mirror) {
      board = placePiece(board, mirroredSquare(square), {
        type: selected.type,
        color: selected.color === 'white' ? 'black' : 'white',
      })
    }
    updateBoard(board)
  }

  function handlePlay() {
    if (!canPlay) return
    const board = setup.board.slice()
    onPlay({
      ...setup,
      board,
      castling: initialCastlingUnmoved(board),
      turn: 'white',
      enPassant: null,
    })
  }

  const squares: SquareIndex[] = []
  for (let rank = size - 1; rank >= 0; rank--) {
    for (let file = 0; file < size; file++) {
      squares.push(fileRankToIndex(file, rank, size))
    }
  }

  return (
    <main className="editor-screen">
      <header className="game-header">
        <h1>Sandbox</h1>
        <p>
          Select a piece, then click a square. With Mirror on, the opposite
          color is placed on the opposite rank.
        </p>
      </header>

      <div className="size-picker" role="group" aria-label="Board size">
        {BOARD_SIZES.map((option) => (
          <button
            key={option}
            type="button"
            className={['size-option', size === option ? 'active' : '']
              .filter(Boolean)
              .join(' ')}
            aria-pressed={size === option}
            onClick={() => handleSizeChange(option)}
          >
            {boardSizeLabel(option)}
          </button>
        ))}
      </div>

      <div className="editor-layout">
        <div className="palette" role="toolbar" aria-label="Piece palette">
          <section className="palette-section" aria-label="Classic">
            <p className="palette-section-label">Classic</p>
            <PaletteGroup
              label="White classic"
              color="white"
              types={CLASSIC_PIECES}
              selected={selected}
              onSelect={setSelected}
            />
            <PaletteGroup
              label="Black classic"
              color="black"
              types={CLASSIC_PIECES}
              selected={selected}
              onSelect={setSelected}
            />
          </section>

          <section className="palette-section" aria-label="Expansion">
            <p className="palette-section-label">Expansion</p>
            <PaletteGroup
              label="White expansion"
              color="white"
              types={EXPANSION_PIECES}
              selected={selected}
              onSelect={setSelected}
            />
            <PaletteGroup
              label="Black expansion"
              color="black"
              types={EXPANSION_PIECES}
              selected={selected}
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
            aria-label="Eraser"
          >
            Erase
          </button>
        </div>

        <div
          className="board editor-board"
          role="grid"
          aria-label="Board editor"
          style={{ '--board-size': size } as CSSProperties}
        >
          {squares.map((square) => {
            const { file, rank } = indexToFileRank(square, size)
            const light = (file + rank) % 2 === 1
            const piece = setup.board[square]

            return (
              <button
                key={square}
                type="button"
                className={['square', light ? 'light' : 'dark'].join(' ')}
                onClick={() => handleSquareClick(square)}
                aria-label={`Square ${String.fromCharCode(97 + file)}${rank + 1}`}
              >
                {piece ? <PieceView piece={piece} /> : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="editor-controls">
        <label className="mirror-toggle">
          <input
            type="checkbox"
            checked={mirror}
            onChange={(event) => setMirror(event.target.checked)}
          />
          Mirror
        </label>

        <div className="editor-actions">
          <button
            type="button"
            className="reset"
            onClick={() => setSetup(emptySetup(size))}
          >
            Clear
          </button>
          <button
            type="button"
            className="reset"
            disabled={size !== 8}
            onClick={() => setSetup(classicSetup())}
            title={size !== 8 ? 'Classic layout is 8×8 only' : undefined}
          >
            Load classic
          </button>
          <button type="button" className="reset" onClick={onBack}>
            Reset editor
          </button>
          <button
            type="button"
            className="reset primary"
            disabled={!canPlay}
            onClick={handlePlay}
          >
            Play
          </button>
        </div>
      </div>

      {issues.length > 0 ? (
        <ul className="setup-issues">
          {issues.map((issue) => (
            <li key={issue}>{setupIssueMessage(issue)}</li>
          ))}
        </ul>
      ) : (
        <p className="setup-ok">Position is legal — ready to play.</p>
      )}
    </main>
  )
}

function PaletteGroup({
  label,
  color,
  types,
  selected,
  onSelect,
}: {
  label: string
  color: Color
  types: { id: PieceType; name: string; blurb: string }[]
  selected: PaletteSelection
  onSelect: (value: PaletteSelection) => void
}) {
  return (
    <div className="palette-row" aria-label={label}>
      {types.map((entry) => {
        const active =
          selected !== 'erase' &&
          selected.color === color &&
          selected.type === entry.id
        return (
          <button
            key={`${color}-${entry.id}`}
            type="button"
            className={['palette-item', active ? 'active' : '']
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelect({ type: entry.id, color })}
            aria-pressed={active}
            aria-label={`${color} ${entry.name}`}
            title={`${entry.name} — ${entry.blurb}`}
          >
            <img src={pieceSprites[color][entry.id]} alt="" draggable={false} />
          </button>
        )
      })}
    </div>
  )
}
