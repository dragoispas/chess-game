import { useState, type FormEvent } from 'react'
import { draftBudgetForSize } from '../engine/catalog.ts'
import { boardSizeLabel } from '../engine/notation.ts'
import type { BoardSize, Color } from '../engine/types.ts'
import {
  getActiveOnlineRooms,
  removeActiveOnline,
} from '../online/activeOnline.ts'
import {
  TIME_CONTROLS,
  type TimeControlId,
} from '../online/timeControls.ts'
import { BOARD_SIZES } from '../shared/coords.ts'
import './PlayMenu.css'
import './OnlineLobby.css'

export type PlayMode = 'draft' | 'blind'
export type PlayOpponent = 'player' | 'stockfish' | 'online'
export type OnlineAction = 'join' | 'create'

type PlayMenuProps = {
  onChoose: (
    mode: PlayMode,
    size: BoardSize,
    opponent: PlayOpponent,
    timeControl: TimeControlId,
    playAs: Color,
  ) => void
  onOnlineJoin: (code: string) => void
}

export function PlayMenu({ onChoose, onOnlineJoin }: PlayMenuProps) {
  const [size, setSize] = useState<BoardSize>(8)
  const [opponent, setOpponent] = useState<PlayOpponent | null>(null)
  const [onlineAction, setOnlineAction] = useState<OnlineAction>('join')
  const [timeControl, setTimeControl] = useState<TimeControlId>('5+5')
  const [playAs, setPlayAs] = useState<Color>('white')
  const [joinInput, setJoinInput] = useState('')
  const [activeRooms, setActiveRooms] = useState(getActiveOnlineRooms)
  const budget = draftBudgetForSize(size)
  const timeBlurb = TIME_CONTROLS.find((entry) => entry.id === timeControl)?.blurb
  const showLocalSetup = opponent === 'player' || opponent === 'stockfish'
  const showOnlineCreate = opponent === 'online' && onlineAction === 'create'
  const showOnlineJoin = opponent === 'online' && onlineAction === 'join'
  const sideLabel = playAs === 'white' ? 'White' : 'Black'
  const otherSideLabel = playAs === 'white' ? 'Black' : 'White'

  function handleJoin(event: FormEvent) {
    event.preventDefault()
    const value = joinInput.trim().toUpperCase()
    if (!value) return
    onOnlineJoin(value)
  }

  function handleDismissResume(code: string) {
    removeActiveOnline(code)
    setActiveRooms(getActiveOnlineRooms())
  }

  return (
    <main className="play-menu">
      <header className="game-header">
        <h1>Play</h1>
        <p>
          {!opponent
            ? 'Choose Local, Stockfish, or Online.'
            : opponent === 'online'
              ? onlineAction === 'join'
                ? 'Enter a room code to join a friend’s game.'
                : 'Choose size, side, time control, and a mode to host a room.'
              : 'Pick board size, your side, then a mode.'}
        </p>
      </header>

      {activeRooms.length > 0 ? (
        <div className="play-mode-grid">
          {activeRooms.map((code) => (
            <div key={code} className="resume-row">
              <button
                type="button"
                className="play-mode-card"
                onClick={() => onOnlineJoin(code)}
              >
                <span className="play-mode-title">Resume {code}</span>
                <span className="play-mode-blurb">
                  Reconnect with this room code (works from another device too).
                </span>
              </button>
              <button
                type="button"
                className="reset"
                onClick={() => handleDismissResume(code)}
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="size-picker" role="group" aria-label="Opponent">
        {(
          [
            ['player', 'Local'],
            ['stockfish', 'Stockfish'],
            ['online', 'Online'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={['size-option', opponent === value ? 'active' : '']
              .filter(Boolean)
              .join(' ')}
            aria-pressed={opponent === value}
            onClick={() => setOpponent(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {opponent === 'online' ? (
        <div className="size-picker" role="group" aria-label="Online action">
          {(
            [
              ['join', 'Join'],
              ['create', 'Create'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={[
                'size-option',
                onlineAction === value ? 'active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={onlineAction === value}
              onClick={() => setOnlineAction(value)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {showOnlineJoin ? (
        <form className="online-join" onSubmit={handleJoin}>
          <input
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
            placeholder="ROOM CODE"
            aria-label="Room code"
            maxLength={8}
            autoFocus
          />
          <button
            type="submit"
            className="reset primary"
            disabled={!joinInput.trim()}
          >
            Join
          </button>
        </form>
      ) : null}

      {showLocalSetup || showOnlineCreate ? (
        <div className="size-picker" role="group" aria-label="Board size">
          {BOARD_SIZES.map((option) => (
            <button
              key={option}
              type="button"
              className={['size-option', size === option ? 'active' : '']
                .filter(Boolean)
                .join(' ')}
              aria-pressed={size === option}
              onClick={() => setSize(option)}
            >
              {boardSizeLabel(option)}
            </button>
          ))}
        </div>
      ) : null}

      {showLocalSetup || showOnlineCreate ? (
        <div className="size-picker" role="group" aria-label="Play as">
          {(
            [
              ['white', 'White'],
              ['black', 'Black'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={['size-option', playAs === value ? 'active' : '']
                .filter(Boolean)
                .join(' ')}
              aria-pressed={playAs === value}
              onClick={() => setPlayAs(value)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {showOnlineCreate ? (
        <>
          <div className="size-picker" role="group" aria-label="Time control">
            {TIME_CONTROLS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={[
                  'size-option',
                  timeControl === entry.id ? 'active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={timeControl === entry.id}
                title={entry.blurb}
                onClick={() => setTimeControl(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
          {timeBlurb ? (
            <p className="time-control-blurb">{timeBlurb}</p>
          ) : null}
        </>
      ) : null}

      {showLocalSetup || showOnlineCreate ? (
        <div className="play-mode-grid">
          <button
            type="button"
            className="play-mode-card"
            onClick={() => {
              if (!opponent) return
              onChoose(
                'draft',
                size,
                showOnlineCreate ? 'online' : opponent,
                timeControl,
                playAs,
              )
            }}
          >
            <span className="play-mode-title">Draft</span>
            <span className="play-mode-blurb">
              {showOnlineCreate
                ? `Host a simultaneous ${budget}-point Draft on ${boardSizeLabel(size)} (${timeControl}). You play ${sideLabel}.`
                : opponent === 'stockfish'
                  ? `Starts from a standard ${boardSizeLabel(size)} board. You customize ${sideLabel} within ${budget} points; Stockfish keeps the standard ${otherSideLabel} army.`
                  : `Each side spends ${budget} points building an army on their half of a ${boardSizeLabel(size)} board — ${sideLabel} first, then ${otherSideLabel}, without peeking.`}
            </span>
          </button>

          <button
            type="button"
            className="play-mode-card"
            onClick={() => {
              if (!opponent) return
              onChoose(
                'blind',
                size,
                showOnlineCreate ? 'online' : opponent,
                timeControl,
                playAs,
              )
            }}
          >
            <span className="play-mode-title">Blind</span>
            <span className="play-mode-blurb">
              {showOnlineCreate
                ? `Host a mirrored ${budget}-point Blind game on ${boardSizeLabel(size)} (${timeControl}). You play ${sideLabel}.`
                : `A full pawn rank plus a ${budget - size}-point random officer row (king included, expansion allowed), mirrored on ${boardSizeLabel(size)}${opponent === 'stockfish' ? `. You play ${sideLabel} vs Stockfish.` : `. You sit as ${sideLabel}.`}`}
            </span>
          </button>
        </div>
      ) : null}
    </main>
  )
}
