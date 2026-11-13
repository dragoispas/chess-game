import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db, schema } from '../db/index.ts'
import { now, rooms } from './store.ts'
import type { LiveRoom } from './types.ts'

export function persistEvent(
  gameId: string,
  seq: number,
  type: string,
  payload: unknown,
) {
  db.insert(schema.gameEvents)
    .values({
      id: randomUUID(),
      gameId,
      seq,
      type,
      payloadJson: JSON.stringify(payload),
      createdAt: now(),
    })
    .run()
}

export function persistGame(room: LiveRoom) {
  const finished = room.state.status !== 'ongoing'
  db.update(schema.games)
    .set({
      status: finished ? 'finished' : room.black ? 'ongoing' : 'lobby',
      stateJson: JSON.stringify(room.state),
      setupJson: JSON.stringify(room.setup),
      whitePlayerId: room.white?.playerId ?? null,
      blackPlayerId: room.black?.playerId ?? null,
      result: room.state.winner,
      finishedAt: finished ? now() : null,
    })
    .where(eq(schema.games.id, room.gameId))
    .run()
}

export function ensurePlayer(playerId: string) {
  const existing = db
    .select()
    .from(schema.players)
    .where(eq(schema.players.id, playerId))
    .get()
  if (existing) return
  db.insert(schema.players)
    .values({ id: playerId, displayName: null, createdAt: now() })
    .run()
}

export function closeRoomRecord(room: LiveRoom) {
  db.update(schema.rooms)
    .set({ status: 'closed' })
    .where(eq(schema.rooms.code, room.code))
    .run()
}

/** Persist closed status and drop the room from the live map. */
export function retireLiveRoom(room: LiveRoom) {
  closeRoomRecord(room)
  rooms.delete(room.code)
}
