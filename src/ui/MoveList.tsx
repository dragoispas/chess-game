import { useEffect, useRef } from 'react'

type MoveListProps = {
  moves: string[]
}

export function MoveList({ moves }: MoveListProps) {
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    list.scrollTop = list.scrollHeight
  }, [moves])

  return (
    <ol ref={listRef} className="move-list" aria-label="Move list">
      {moves.length === 0 ? (
        <li className="move-list-empty">No moves yet</li>
      ) : (
        Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => {
          const white = moves[i * 2]
          const black = moves[i * 2 + 1]
          return (
            <li key={i}>
              <span className="move-num">{i + 1}.</span>
              <span>{white}</span>
              {black ? <span>{black}</span> : null}
            </li>
          )
        })
      )}
    </ol>
  )
}
