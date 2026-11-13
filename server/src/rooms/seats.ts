import type { Color } from '../../../src/engine/types.ts'
import { playerSocket, rooms } from './store.ts'
import type { LiveRoom, Seat } from './types.ts'

export function seatConnected(seat: Seat | null | undefined): boolean {
  return !!seat?.socket && seat.socket.readyState === seat.socket.OPEN
}

export function seatPresence(room: LiveRoom): {
  whiteConnected: boolean
  blackConnected: boolean
} {
  return {
    whiteConnected: seatConnected(room.white),
    blackConnected: seatConnected(room.black),
  }
}

export function isSoloWaitingLobby(room: LiveRoom): boolean {
  return !room.white || !room.black
}

export function colorForPlayer(
  room: LiveRoom,
  playerId: string,
): Color | null {
  if (room.white?.playerId === playerId) return 'white'
  if (room.black?.playerId === playerId) return 'black'
  return null
}

export function attachSeat(
  room: LiveRoom,
  color: Color,
  playerId: string,
): Seat {
  const socket = playerSocket.get(playerId) ?? null
  const seat: Seat = {
    playerId,
    color,
    socket,
    disconnectedAt: null,
  }
  if (color === 'white') room.white = seat
  else room.black = seat
  return seat
}

export function findRoomForPlayer(playerId: string): LiveRoom | null {
  let disconnected: LiveRoom | null = null
  for (const room of rooms.values()) {
    if (room.phase === 'playing' && room.state.status !== 'ongoing') continue
    const seat =
      room.white?.playerId === playerId
        ? room.white
        : room.black?.playerId === playerId
          ? room.black
          : null
    if (!seat || !seat.playerId) continue
    if (seatConnected(seat)) return room
    disconnected = room
  }
  return disconnected
}
