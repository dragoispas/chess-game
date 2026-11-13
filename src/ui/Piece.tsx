import type { Piece as PieceModel } from '../engine/types.ts'
import { pieceSprites } from './pieces.ts'

type PieceProps = {
  piece: PieceModel
  className?: string
}

export function Piece({ piece, className }: PieceProps) {
  const src = pieceSprites[piece.color][piece.type]

  return (
    <img
      src={src}
      alt={`${piece.color} ${piece.type}`}
      draggable={false}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    />
  )
}
