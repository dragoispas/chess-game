import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { getPiece } from '../engine/board.ts'
import { tryMove } from '../engine/game.ts'
import { legalMoves, toPosition } from '../engine/moves.ts'
import type {
  GameState,
  LastMove,
  Piece as PieceModel,
  PromotionPiece,
  SquareIndex,
} from '../engine/types.ts'
import { fileRankToIndex, indexToFileRank } from '../shared/coords.ts'
import { Piece } from './Piece.tsx'
import { PromotionPicker } from './PromotionPicker.tsx'
import { pieceSprites } from './pieces.ts'
import './Board.css'

const DRAG_THRESHOLD_PX = 6

export type BoardMoveEvent = {
  state: GameState
  from: SquareIndex
  to: SquareIndex
  promotion?: PromotionPiece
}

type BoardProps = {
  game: GameState
  lastMove: LastMove | null
  /** When false, clicks/drags are ignored (e.g. Stockfish’s turn). */
  interactive?: boolean
  /** Whose perspective to show (Black flips the board). */
  orientation?: 'white' | 'black'
  onMove: (event: BoardMoveEvent) => void
}

type DragSession = {
  from: SquareIndex
  pointerId: number
  startX: number
  startY: number
  didDrag: boolean
}

type PendingPromotion = {
  from: SquareIndex
  to: SquareIndex
}

export function Board({
  game,
  lastMove,
  interactive = true,
  orientation = 'white',
  onMove,
}: BoardProps) {
  const [selected, setSelected] = useState<SquareIndex | null>(null)
  const [dragging, setDragging] = useState(false)
  const [ghost, setGhost] = useState<{
    piece: PieceModel
    x: number
    y: number
  } | null>(null)
  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion | null>(null)

  const dragRef = useRef<DragSession | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const { size } = game

  const [wasInteractive, setWasInteractive] = useState(interactive)
  if (interactive !== wasInteractive) {
    setWasInteractive(interactive)
    if (!interactive) {
      setSelected(null)
      setPendingPromotion(null)
      setDragging(false)
      setGhost(null)
    }
  }

  const position = useMemo(() => toPosition(game), [game])

  const targets = useMemo(() => {
    if (!interactive || selected === null || pendingPromotion) {
      return new Set<SquareIndex>()
    }
    return new Set(legalMoves(position, selected))
  }, [interactive, position, selected, pendingPromotion])

  function squareFromPoint(clientX: number, clientY: number): SquareIndex | null {
    const el = document.elementFromPoint(clientX, clientY)
    const squareEl = el?.closest<HTMLElement>('[data-square]')
    if (!squareEl) return null
    return Number(squareEl.dataset.square)
  }

  function clearDrag() {
    dragRef.current = null
    setDragging(false)
    setGhost(null)
  }

  function commitMove(
    from: SquareIndex,
    to: SquareIndex,
    promotion?: PromotionPiece,
  ) {
    const result = tryMove(game, from, to, promotion)
    if (result.type === 'moved') {
      onMove({ state: result.state, from, to, promotion })
      setSelected(null)
      setPendingPromotion(null)
      return true
    }
    if (result.type === 'needs-promotion') {
      setSelected(null)
      setPendingPromotion({ from: result.from, to: result.to })
      return true
    }
    return false
  }

  function handlePointerDown(
    square: SquareIndex,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (event.button !== 0) return
    if (!interactive || game.status !== 'ongoing' || pendingPromotion) return

    const piece = getPiece(game.board, square)

    if (piece && piece.color === game.turn) {
      setSelected(square)
      dragRef.current = {
        from: square,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        didDrag: false,
      }
      boardRef.current?.setPointerCapture(event.pointerId)
      return
    }

    if (selected !== null) {
      dragRef.current = {
        from: selected,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        didDrag: false,
      }
      boardRef.current?.setPointerCapture(event.pointerId)
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const session = dragRef.current
    if (!session || session.pointerId !== event.pointerId) return

    const dx = event.clientX - session.startX
    const dy = event.clientY - session.startY
    if (!session.didDrag && Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
      const piece = getPiece(game.board, session.from)
      if (!piece) {
        clearDrag()
        return
      }
      session.didDrag = true
      setDragging(true)
      setGhost({ piece, x: event.clientX, y: event.clientY })
      return
    }

    if (session.didDrag) {
      setGhost((prev) =>
        prev ? { ...prev, x: event.clientX, y: event.clientY } : prev,
      )
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const session = dragRef.current
    if (!session || session.pointerId !== event.pointerId) return

    const to = squareFromPoint(event.clientX, event.clientY)

    if (to !== null && to !== session.from) {
      if (commitMove(session.from, to)) {
        clearDrag()
        return
      }

      if (!session.didDrag) {
        const piece = getPiece(game.board, to)
        if (piece && piece.color === game.turn) {
          setSelected(to)
        } else {
          setSelected(null)
        }
      }
    }

    clearDrag()
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    const session = dragRef.current
    if (!session || session.pointerId !== event.pointerId) return
    clearDrag()
  }

  const squares: SquareIndex[] = []
  if (orientation === 'white') {
    for (let rank = size - 1; rank >= 0; rank--) {
      for (let file = 0; file < size; file++) {
        squares.push(fileRankToIndex(file, rank, size))
      }
    }
  } else {
    for (let rank = 0; rank < size; rank++) {
      for (let file = size - 1; file >= 0; file--) {
        squares.push(fileRankToIndex(file, rank, size))
      }
    }
  }

  const promotionPiece =
    pendingPromotion != null
      ? getPiece(game.board, pendingPromotion.from)
      : null

  return (
    <>
      <div
        ref={boardRef}
        className={[
          'board',
          game.status !== 'ongoing' ? 'game-over' : '',
          pendingPromotion ? 'awaiting-promotion' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="grid"
        aria-label="Chess board"
        aria-disabled={!interactive}
        style={{ '--board-size': size } as CSSProperties}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {squares.map((square) => {
          const { file, rank } = indexToFileRank(square, size)
          const light = (file + rank) % 2 === 1
          const piece = getPiece(game.board, square)
          const isSelected = selected === square
          const isTarget = targets.has(square)
          const isOriginDragging = dragging && selected === square
          const isLastMove =
            lastMove !== null &&
            (square === lastMove.from || square === lastMove.to)
          const showPromotion =
            pendingPromotion !== null &&
            pendingPromotion.to === square &&
            promotionPiece !== null

          const isCaptureTarget =
            isTarget &&
            (piece !== null ||
              (game.enPassant !== null && square === game.enPassant))

          return (
            <button
              key={square}
              type="button"
              data-square={square}
              className={[
                'square',
                light ? 'light' : 'dark',
                isSelected ? 'selected' : '',
                isLastMove ? 'last-move' : '',
                isTarget ? 'target' : '',
                isCaptureTarget ? 'occupied' : '',
                isOriginDragging ? 'dragging' : '',
                showPromotion ? 'promoting' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onPointerDown={(event) => handlePointerDown(square, event)}
              aria-label={`Square ${String.fromCharCode(97 + file)}${rank + 1}`}
            >
              {piece && !showPromotion ? <Piece piece={piece} /> : null}
              {showPromotion && promotionPiece ? (
                <PromotionPicker
                  color={promotionPiece.color}
                  direction={promotionPiece.color === 'white' ? 'down' : 'up'}
                  onChoose={(choice) =>
                    commitMove(pendingPromotion.from, pendingPromotion.to, choice)
                  }
                  onCancel={() => setPendingPromotion(null)}
                />
              ) : null}
            </button>
          )
        })}
      </div>

      {ghost ? (
        <img
          className="drag-ghost"
          src={pieceSprites[ghost.piece.color][ghost.piece.type]}
          alt=""
          draggable={false}
          style={{
            left: ghost.x,
            top: ghost.y,
          }}
        />
      ) : null}
    </>
  )
}
