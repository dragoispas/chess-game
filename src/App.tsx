import { useState } from 'react'
import { generateBlindSetup } from './engine/blind.ts'
import { classicSetup } from './engine/setup.ts'
import type { BoardSetup, BoardSize, Color } from './engine/types.ts'
import type { TimeControlId } from './online/timeControls.ts'
import './ui/AppShell.css'
import { CreditsScreen } from './ui/CreditsScreen.tsx'
import { DraftScreen } from './ui/DraftScreen.tsx'
import { EditorScreen } from './ui/EditorScreen.tsx'
import { GameScreen } from './ui/GameScreen.tsx'
import { OnlineDraftScreen } from './ui/OnlineDraftScreen.tsx'
import { OnlineGameScreen } from './ui/OnlineGameScreen.tsx'
import {
  OnlineLobby,
  type OnlineDraftReady,
  type OnlineLobbyIntent,
  type OnlineReady,
} from './ui/OnlineLobby.tsx'
import {
  PlayMenu,
  type PlayMode,
  type PlayOpponent,
} from './ui/PlayMenu.tsx'
import { SideNav, type AppNav } from './ui/SideNav.tsx'

type PlayPhase =
  | 'menu'
  | 'draft'
  | 'draft-game'
  | 'blind-game'
  | 'online-lobby'
  | 'online-draft'
  | 'online-game'
type SandboxPhase = 'edit' | 'game'

function App() {
  const [nav, setNav] = useState<AppNav>('play')
  const [playPhase, setPlayPhase] = useState<PlayPhase>('menu')
  const [playSize, setPlaySize] = useState<BoardSize>(8)
  const [playOpponent, setPlayOpponent] = useState<PlayOpponent>('player')
  const [playAs, setPlayAs] = useState<Color>('white')
  const [playSetup, setPlaySetup] = useState<BoardSetup | null>(null)
  const [onlineIntent, setOnlineIntent] = useState<OnlineLobbyIntent | null>(
    null,
  )
  const [onlineSession, setOnlineSession] = useState<OnlineReady | null>(null)
  const [onlineDraft, setOnlineDraft] = useState<OnlineDraftReady | null>(null)
  const [playKey, setPlayKey] = useState(0)

  const [sandboxPhase, setSandboxPhase] = useState<SandboxPhase>('edit')
  const [sandboxSetup, setSandboxSetup] = useState<BoardSetup | null>(null)
  const [sandboxKey, setSandboxKey] = useState(0)

  function resetPlayToMenu() {
    const socket = onlineSession?.socket ?? onlineDraft?.socket
    if (socket) {
      socket.send({ type: 'room:leave' })
      socket.close()
    }
    setOnlineSession(null)
    setOnlineDraft(null)
    setOnlineIntent(null)
    setPlayPhase('menu')
    setPlaySetup(null)
    setPlayKey((key) => key + 1)
  }

  function handleNavigate(next: AppNav) {
    if (nav === 'play' && next !== 'play') resetPlayToMenu()
    setNav(next)
    if (next === 'play') resetPlayToMenu()
  }

  function handleChooseMode(
    mode: PlayMode,
    size: BoardSize,
    opponent: PlayOpponent,
    timeControl: TimeControlId,
    side: Color,
  ) {
    setPlaySize(size)
    setPlayOpponent(opponent)
    setPlayAs(side)

    if (opponent === 'online') {
      setOnlineSession(null)
      setOnlineDraft(null)
      setOnlineIntent({
        action: 'create',
        size,
        timeControl,
        mode,
        preferredColor: side,
      })
      setPlayPhase('online-lobby')
      setPlayKey((key) => key + 1)
      return
    }

    if (mode === 'draft') {
      setPlaySetup(null)
      setPlayPhase('draft')
      setPlayKey((key) => key + 1)
      return
    }

    const setup = generateBlindSetup(size)
    setPlaySetup(setup)
    setPlayPhase('blind-game')
    setPlayKey((key) => key + 1)
  }

  function handleOnlineJoin(code: string) {
    setPlayOpponent('online')
    setOnlineSession(null)
    setOnlineDraft(null)
    setOnlineIntent({ action: 'join', code })
    setPlayPhase('online-lobby')
    setPlayKey((key) => key + 1)
  }

  return (
    <div className="app-shell">
      <SideNav active={nav} onNavigate={handleNavigate} />

      <div className="app-main">
        {nav === 'play' ? (
          playPhase === 'menu' ? (
            <PlayMenu
              onChoose={handleChooseMode}
              onOnlineJoin={handleOnlineJoin}
            />
          ) : playPhase === 'online-lobby' && onlineIntent ? (
            <OnlineLobby
              key={playKey}
              intent={onlineIntent}
              onReady={(session) => {
                setOnlineDraft(null)
                setOnlineSession(session)
                setPlayPhase('online-game')
              }}
              onDraft={(session) => {
                setOnlineDraft(session)
                setPlayPhase('online-draft')
              }}
              onBack={resetPlayToMenu}
            />
          ) : playPhase === 'online-draft' && onlineDraft ? (
            <OnlineDraftScreen
              key={onlineDraft.gameId}
              session={onlineDraft}
              onReady={(session) => {
                setOnlineDraft(null)
                setOnlineSession(session)
                setPlayPhase('online-game')
              }}
              onBack={resetPlayToMenu}
            />
          ) : playPhase === 'online-game' && onlineSession ? (
            <OnlineGameScreen
              key={onlineSession.gameId}
              session={onlineSession}
              onBack={resetPlayToMenu}
            />
          ) : playPhase === 'draft' ? (
            <DraftScreen
              key={playKey}
              size={playSize}
              opponent={playOpponent}
              playAs={playAs}
              onStart={(setup) => {
                setPlaySetup(setup)
                setPlayPhase('draft-game')
                setPlayKey((key) => key + 1)
              }}
            />
          ) : playPhase === 'draft-game' ? (
            <GameScreen
              key={playKey}
              setup={playSetup}
              opponent={playOpponent}
              playAs={playAs}
              title="Point Draft"
              backLabel="Back"
              onBack={resetPlayToMenu}
            />
          ) : (
            <GameScreen
              key={playKey}
              setup={playSetup}
              opponent={playOpponent}
              playAs={playAs}
              title="Blind"
              backLabel="Back"
              onBack={resetPlayToMenu}
            />
          )
        ) : null}

        {nav === 'sandbox' ? (
          sandboxPhase === 'edit' ? (
            <EditorScreen
              key={`edit-${sandboxKey}`}
              initialSetup={sandboxSetup ?? classicSetup()}
              onPlay={(next) => {
                setSandboxSetup(next)
                setSandboxPhase('game')
                setSandboxKey((key) => key + 1)
              }}
              onBack={() => {
                setSandboxSetup(null)
                setSandboxKey((key) => key + 1)
              }}
            />
          ) : (
            <GameScreen
              key={`game-${sandboxKey}`}
              setup={sandboxSetup}
              opponent="player"
              title="Sandbox"
              backLabel="Back to editor"
              onBack={() => setSandboxPhase('edit')}
            />
          )
        ) : null}

        {nav === 'credits' ? <CreditsScreen /> : null}
      </div>
    </div>
  )
}

export default App
