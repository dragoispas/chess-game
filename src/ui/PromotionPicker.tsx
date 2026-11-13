import type { Color, PromotionPiece } from '../engine/types.ts'
import { pieceSprites } from './pieces.ts'

const OPTIONS: PromotionPiece[] = ['queen', 'rook', 'bishop', 'knight']

type PromotionPickerProps = {
  color: Color
  /** White promotes on the top rank visually; stack downward. Black stacks upward. */
  direction: 'down' | 'up'
  onChoose: (piece: PromotionPiece) => void
  onCancel: () => void
}

export function PromotionPicker({
  color,
  direction,
  onChoose,
  onCancel,
}: PromotionPickerProps) {
  return (
    <div
      className={['promotion-picker', direction].join(' ')}
      role="listbox"
      aria-label="Choose promotion piece"
    >
      {OPTIONS.map((type) => (
        <button
          key={type}
          type="button"
          className="promotion-option"
          role="option"
          aria-label={`Promote to ${type}`}
          onClick={(event) => {
            event.stopPropagation()
            onChoose(type)
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <img src={pieceSprites[color][type]} alt="" draggable={false} />
        </button>
      ))}
      <button
        type="button"
        className="promotion-cancel"
        aria-label="Cancel promotion"
        onClick={(event) => {
          event.stopPropagation()
          onCancel()
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        ×
      </button>
    </div>
  )
}
