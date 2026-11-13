import type { WebSocket } from 'ws'
import type { ServerMessage } from '../../../src/online/protocol.ts'
import type { LiveRoom } from './types.ts'

export function send(
  socket: WebSocket | null | undefined,
  message: ServerMessage,
) {
  if (!socket || socket.readyState !== socket.OPEN) return
  socket.send(JSON.stringify(message))
}

export function sendToRoom(room: LiveRoom, message: ServerMessage) {
  send(room.white?.socket, message)
  send(room.black?.socket, message)
}
