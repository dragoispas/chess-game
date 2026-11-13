import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import type { WebSocket } from 'ws'
import { generateBlindSetup } from '../../../src/engine/blind.ts'
import { createGame } from '../../../src/engine/game.ts'
import { emptySetup } from '../../../src/engine/setup.ts'
import type { BoardSize, Color } from '../../../src/engine/types.ts'
import type {
  OnlineGameMode,
  ServerMessage,
} from '../../../src/online/protocol.ts'
import {
  timeControlById,
  type TimeControlId,
} from '../../../src/online/timeControls.ts'
import { db, schema } from '../db/index.ts'
import {
  freezeDisconnectedPlayersClock,
  resumeClockIfRejoinedOnTurn,
} from './clocks.ts'
import { send } from './net.ts'
import {
  draftPlaceholderState,
  draftStatePayload,
  readyPayload,
  statePayload,
} from './payloads.ts'
import {
  ensurePlayer,
  persistEvent,
  persistGame,
  retireLiveRoom,
} from './persist.ts'
import {
  attachSeat,
  isSoloWaitingLobby,
  seatConnected,
} from './seats.ts'
import { now, playerSocket, roomCode, rooms, socketPlayer } from './store.ts'
import { reclaimSeat, syncSeat, vacateFromOtherRooms } from './sync.ts'
import type { LiveRoom, Seat } from './types.ts'

export function bindSocket(socket: WebSocket, playerId: string) {
  ensurePlayer(playerId)
  const prev = playerSocket.get(playerId)
  if (prev && prev !== socket) {
    try {
      prev.close()
    } catch {
      /* ignore */
    }
  }
  socketPlayer.set(socket, playerId)
  playerSocket.set(playerId, socket)

  // Reattach the socket for presence/clocks only. Do not push room:ready /
  // draft:state — that raced with room:create and resumed old rooms.
  // Clients re-enter via room:join (Resume) or room:create.
  for (const room of [...rooms.values()]) {
    if (room.phase === 'playing' && room.state.status !== 'ongoing') {
      retireLiveRoom(room)
      continue
    }
    if (room.white?.playerId === playerId) {
      room.white.socket = socket
      room.white.disconnectedAt = null
      if (room.phase === 'playing') resumeClockIfRejoinedOnTurn(room, 'white')
      if (room.black?.playerId) {
        if (room.phase === 'playing') send(room.black.socket, statePayload(room))
        else syncSeat(room, 'black')
      }
    }
    if (room.black?.playerId === playerId) {
      room.black.socket = socket
      room.black.disconnectedAt = null
      if (room.phase === 'playing') resumeClockIfRejoinedOnTurn(room, 'black')
      if (room.white?.playerId) {
        if (room.phase === 'playing') send(room.white.socket, statePayload(room))
        else syncSeat(room, 'white')
      }
    }
  }
}

export function unbindSocket(socket: WebSocket) {
  const playerId = socketPlayer.get(socket)
  if (!playerId) return
  socketPlayer.delete(socket)
  if (playerSocket.get(playerId) === socket) {
    playerSocket.delete(playerId)
  }
  const droppedAt = Date.now()
  for (const room of rooms.values()) {
    let disconnected: Color | null = null
    if (room.white?.socket === socket) {
      room.white.socket = null
      room.white.disconnectedAt = droppedAt
      disconnected = 'white'
    }
    if (room.black?.socket === socket) {
      room.black.socket = null
      room.black.disconnectedAt = droppedAt
      disconnected = 'black'
    }
    if (!disconnected) continue
    if (isSoloWaitingLobby(room)) {
      retireLiveRoom(room)
      continue
    }
    if (room.phase === 'playing') {
      freezeDisconnectedPlayersClock(room, disconnected)
      sendToRoomState(room)
    } else {
      if (room.white) syncSeat(room, 'white')
      if (room.black) syncSeat(room, 'black')
    }
  }
}

function sendToRoomState(room: LiveRoom) {
  send(room.white?.socket, statePayload(room))
  send(room.black?.socket, statePayload(room))
}

export function createRoom(
  playerId: string,
  size: BoardSize,
  timeControlId: TimeControlId,
  mode: OnlineGameMode,
  preferredColor: Color = 'white',
): ServerMessage {
  ensurePlayer(playerId)
  if (mode !== 'blind' && mode !== 'draft') {
    return {
      type: 'error',
      code: 'bad_mode',
      message: 'Unknown game mode.',
    }
  }
  const timeControl = timeControlById(timeControlId)
  if (!timeControl) {
    return {
      type: 'error',
      code: 'bad_time_control',
      message: 'Unknown time control.',
    }
  }

  const hostColor: Color = preferredColor === 'black' ? 'black' : 'white'

  vacateFromOtherRooms(playerId, null)

  const isDraft = mode === 'draft'
  const setup = isDraft ? emptySetup(size) : generateBlindSetup(size)
  const state = isDraft
    ? draftPlaceholderState(size)
    : createGame(setup)
  const gameId = randomUUID()
  let code = roomCode()
  while (rooms.has(code)) code = roomCode()

  const hostSeat: Seat = {
    playerId,
    color: hostColor,
    socket: playerSocket.get(playerId) ?? null,
    disconnectedAt: null,
  }

  const room: LiveRoom = {
    code,
    gameId,
    mode,
    phase: isDraft ? 'waiting' : 'playing',
    size,
    setup,
    state,
    hostPlayerId: playerId,
    white: hostColor === 'white' ? hostSeat : null,
    black: hostColor === 'black' ? hostSeat : null,
    eventSeq: 0,
    lastMove: null,
    moveLog: [],
    timeControl,
    whiteMs: timeControl.initialMs,
    blackMs: timeControl.initialMs,
    turnStartedAt: null,
    draftWhite: emptySetup(size).board,
    draftBlack: emptySetup(size).board,
    whiteReady: false,
    blackReady: false,
  }
  rooms.set(code, room)

  db.insert(schema.games)
    .values({
      id: gameId,
      mode,
      size,
      status: 'lobby',
      setupJson: JSON.stringify(setup),
      stateJson: JSON.stringify(state),
      whitePlayerId: hostColor === 'white' ? playerId : null,
      blackPlayerId: hostColor === 'black' ? playerId : null,
      result: null,
      createdAt: now(),
      finishedAt: null,
    })
    .run()

  db.insert(schema.rooms)
    .values({
      code,
      gameId,
      hostPlayerId: playerId,
      status: 'open',
      createdAt: now(),
    })
    .run()

  room.eventSeq += 1
  persistEvent(gameId, room.eventSeq, 'create', {
    playerId,
    size,
    timeControl: timeControl.id,
    mode,
    preferredColor: hostColor,
  })

  send(hostSeat.socket, {
    type: 'room:created',
    code,
    gameId,
    color: hostColor,
    timeControl: timeControl.id,
    mode,
  })
  if (isDraft) {
    send(hostSeat.socket, draftStatePayload(room, hostColor, true))
  } else {
    send(hostSeat.socket, readyPayload(room, hostColor, true))
  }

  return {
    type: 'room:created',
    code,
    gameId,
    color: hostColor,
    timeControl: timeControl.id,
    mode,
  }
}

export function joinRoom(playerId: string, code: string): ServerMessage {
  ensurePlayer(playerId)
  const normalized = code.trim().toUpperCase()
  const room = rooms.get(normalized)
  if (!room) {
    return { type: 'error', code: 'room_not_found', message: 'Room not found.' }
  }
  if (room.phase === 'playing' && room.state.status !== 'ongoing') {
    retireLiveRoom(room)
    return {
      type: 'error',
      code: 'game_over',
      message: 'This game has ended.',
    }
  }

  if (room.white?.playerId === playerId) {
    vacateFromOtherRooms(playerId, room.code)
    const seat = room.white
    seat.socket = playerSocket.get(playerId) ?? null
    seat.disconnectedAt = null
    if (room.phase === 'playing') resumeClockIfRejoinedOnTurn(room, 'white')
    syncSeat(room, 'white')
    if (room.black) syncSeat(room, 'black')
    return {
      type: 'room:joined',
      code: room.code,
      gameId: room.gameId,
      color: 'white',
      mode: room.mode,
    }
  }
  if (room.black?.playerId === playerId) {
    vacateFromOtherRooms(playerId, room.code)
    const seat = room.black
    seat.socket = playerSocket.get(playerId) ?? null
    seat.disconnectedAt = null
    if (room.phase === 'playing') resumeClockIfRejoinedOnTurn(room, 'black')
    syncSeat(room, 'black')
    if (room.white) syncSeat(room, 'white')
    return {
      type: 'room:joined',
      code: room.code,
      gameId: room.gameId,
      color: 'black',
      mode: room.mode,
    }
  }

  if (!room.white || !room.black) {
    const openColor: Color = !room.white ? 'white' : 'black'
    const hostSeat = openColor === 'white' ? room.black : room.white
    if (!seatConnected(hostSeat)) {
      return reclaimSeat(room, hostSeat!.color, playerId)
    }
    vacateFromOtherRooms(playerId, room.code)
    const joiner = attachSeat(room, openColor, playerId)
    room.turnStartedAt = null
    if (room.mode === 'draft') {
      room.phase = 'draft'
      room.whiteReady = false
      room.blackReady = false
    }
    room.eventSeq += 1
    persistEvent(room.gameId, room.eventSeq, 'join', {
      playerId,
      color: openColor,
    })
    persistGame(room)
    db.update(schema.rooms)
      .set({ status: 'full' })
      .where(eq(schema.rooms.code, room.code))
      .run()

    send(joiner.socket, {
      type: 'room:joined',
      code: room.code,
      gameId: room.gameId,
      color: openColor,
      mode: room.mode,
    })
    syncSeat(room, 'white')
    syncSeat(room, 'black')

    return {
      type: 'room:joined',
      code: room.code,
      gameId: room.gameId,
      color: openColor,
      mode: room.mode,
    }
  }

  const whiteOpen = !seatConnected(room.white)
  const blackOpen = !seatConnected(room.black)

  if (!whiteOpen && !blackOpen) {
    return { type: 'error', code: 'room_full', message: 'Room is full.' }
  }
  if (whiteOpen && !blackOpen) {
    return reclaimSeat(room, 'white', playerId)
  }
  if (blackOpen && !whiteOpen) {
    return reclaimSeat(room, 'black', playerId)
  }

  const whiteAt = room.white?.disconnectedAt ?? 0
  const blackAt = room.black?.disconnectedAt ?? 0
  const color: Color = whiteAt > blackAt ? 'white' : 'black'
  return reclaimSeat(room, color, playerId)
}
