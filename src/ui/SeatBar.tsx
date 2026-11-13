import type { Piece } from '../engine/types.ts'
import { pieceSprites } from './pieces.ts'

export function SeatBar({
  name,
  pieces,
}: {
  name: string
  pieces: Piece[]
}) {
  return (
    <div className="seat-bar">
      <span className="seat-name">{name}</span>
      <div className="seat-captures" aria-label={`${name} captures`}>
        {pieces.length === 0 ? (
          <span className="capture-empty">—</span>
        ) : (
          pieces.map((piece, index) => (
            <img
              key={`${piece.color}-${piece.type}-${index}`}
              src={pieceSprites[piece.color][piece.type]}
              alt={`${piece.color} ${piece.type}`}
              draggable={false}
            />
          ))
        )}
      </div>
    </div>
  )
}
