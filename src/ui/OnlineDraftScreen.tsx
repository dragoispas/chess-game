import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  CLASSIC_PIECES,
  EXPANSION_PIECES,
  isDraftSquare,
} from '../engine/catalog.ts'
import { countKings, spentOnBoard } from '../engine/draft.ts'
import type {
  BoardSize,
  Color,
  PieceType,
  SquareIndex,
} from '../engine/types.ts'
import type { ServerMessage } from '../online/protocol.ts'
import { fileRankToIndex, indexToFileRank } from '../shared/coords.ts'
import {
  sessionFromReady,
  type OnlineDraftReady,
  type OnlineReady,
} from './OnlineLobby.tsx'
import { Piece as PieceView } from './Piece.tsx'
import './Board.css'
import './EditorScreen.css'
import './DraftScreen.css'
import './OnlineLobby.css'

type PaletteSelection = PieceType | 'erase'

type OnlineDraftScreenProps = {
  session: OnlineDraftReady
  onReady: (session: OnlineReady) => void
  onBack: () => void
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

export function OnlineDraftScreen({
  session,
  onReady,
  onBack,
}: OnlineDraftScreenProps) {
  const [board, setBoard] = useState(session.board)
  const [youReady, setYouReady] = useState(session.youReady)
  const [opponentReady, setOpponentReady] = useState(session.opponentReady)
  const [seats, setSeats] = useState(session.seats)
  const [selected, setSelected] = useState<PaletteSelection>('king')
  const [error, setError] = useState<string | null>(null)
  const handedOffRef = useRef(false)
  const onReadyRef = useRef(onReady)

  const color = session.you
  const size = session.size
  const budget = session.budget

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    const unsubscribe = session.socket.subscribe((message: ServerMessage) => {
      if (message.type === 'error') {
        setError(message.message)
        return
      }
      if (message.type === 'draft:state') {
        setBoard(message.board)
        setYouReady(message.youReady)
        setOpponentReady(message.opponentReady)
        setSeats(message.seats)
        setError(null)
        return
      }
      if (message.type === 'room:ready' && !message.waiting) {
        handedOffRef.current = true
        onReadyRef.current(sessionFromReady(session.socket, message))
      }
    })
    // Don't close the socket here — React Strict Mode remounts would kill it
    // before any draft:place can land. Leave/Back owns teardown.
    return unsubscribe
  }, [session.socket])

  const spent = spentOnBoard(board, color)
  const remaining = budget - spent
  const kings = countKings(board, color)
  const canConfirm = kings === 1 && remaining >= 0 && !youReady

  const sideLabel: Color = color

  const statusLine = useMemo(() => {
    const opp =
      color === 'white'
        ? seats.blackConnected
          ? 'connected'
          : 'disconnected'
        : seats.whiteConnected
          ? 'connected'
          : 'disconnected'
    if (youReady && opponentReady) return 'Merging armies…'
    if (youReady) return `Locked in — waiting for opponent (${opp}).`
    if (opponentReady) return `Opponent is ready (${opp}). Finish your army.`
    return `Drafting simultaneously — opponent ${opp}.`
  }, [youReady, opponentReady, seats, color])

  function handleSquareClick(square: SquareIndex) {
    if (youReady) return
    if (!isDraftSquare(color, square, size)) return
    setError(null)
    if (selected === 'erase') {
      session.socket.send({
        type: 'draft:place',
        square,
        pieceType: null,
      })
      return
    }
    session.socket.send({
      type: 'draft:place',
      square,
      pieceType: selected,
    })
  }

  function handleClear() {
    if (youReady) return
    setError(null)
    session.socket.send({ type: 'draft:clear' })
  }

  function handleConfirm() {
    if (!canConfirm) return
    setError(null)
    session.socket.send({ type: 'draft:confirm' })
  }

  function handleUnconfirm() {
    setError(null)
    session.socket.send({ type: 'draft:unconfirm' })
  }

  function handleBack() {
    session.socket.send({ type: 'room:leave' })
    session.socket.close()
    onBack()
  }

  return (
    <main className="draft-screen">
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
            <h1>Online Draft — {sideLabel === 'white' ? 'White' : 'Black'}</h1>
            <p>
              Room <strong>{session.code}</strong> · budget {budget} ·{' '}
              {session.timeControl}
            </p>
          </div>
        </div>
      </header>

      <p className="online-status" aria-live="polite">
        {statusLine}
      </p>

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
              disabled={youReady}
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
              disabled={youReady}
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
            disabled={youReady}
          >
            Erase
          </button>
        </div>

        <div
          className="board draft-board"
          role="grid"
          aria-label="Your draft board"
          style={{ '--board-size': size } as CSSProperties}
        >
          {boardSquares(size, color).map((square) => {
            const { file, rank } = indexToFileRank(square, size)
            const light = (file + rank) % 2 === 1
            const own = isDraftSquare(color, square, size)
            const piece = own ? board[square] : null

            return (
              <button
                key={square}
                type="button"
                disabled={!own || youReady}
                className={[
                  'square',
                  light ? 'light' : 'dark',
                  own ? 'draft-own' : 'draft-other',
                  own ? '' : 'draft-fog',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleSquareClick(square)}
                aria-label={`Square ${String.fromCharCode(97 + file)}${rank + 1}`}
              >
                {piece ? <PieceView piece={piece} /> : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="draft-actions">
        <button
          type="button"
          className="reset"
          onClick={handleClear}
          disabled={youReady}
        >
          Clear my half
        </button>
        {youReady ? (
          <button
            type="button"
            className="reset"
            onClick={handleUnconfirm}
          >
            Unconfirm
          </button>
        ) : (
          <button
            type="button"
            className="reset primary"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            Confirm army
          </button>
        )}
      </div>

      {!canConfirm && !youReady ? (
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

      {error ? <p className="online-error">{error}</p> : null}
    </main>
  )
}

function DraftPaletteRow({
  color,
  types,
  selected,
  remaining,
  disabled,
  onSelect,
}: {
  color: Color
  types: { id: PieceType; name: string; cost: number; blurb: string }[]
  selected: PaletteSelection
  remaining: number
  disabled: boolean
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
            title={`${entry.name} (${entry.cost}) — ${entry.blurb}`}
            disabled={disabled}
          >
            <PieceView piece={{ type: entry.id, color }} />
            <span className="draft-cost">{entry.cost}</span>
          </button>
        )
      })}
    </div>
  )
}
