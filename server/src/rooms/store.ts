import { randomBytes } from 'node:crypto'
import type { WebSocket } from 'ws'
import type { LiveRoom } from './types.ts'

export const rooms = new Map<string, LiveRoom>()
export const socketPlayer = new WeakMap<WebSocket, string>()
export const playerSocket = new Map<string, WebSocket>()

export function now() {
  return new Date()
}

export function roomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(6)
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += alphabet[bytes[i]! % alphabet.length]
  }
  return code
}
