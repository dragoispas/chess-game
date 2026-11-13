import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  displayName: text('display_name'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const games = sqliteTable('games', {
  id: text('id').primaryKey(),
  mode: text('mode').notNull(), // 'blind'
  size: integer('size').notNull(),
  status: text('status').notNull(), // lobby | ongoing | finished
  setupJson: text('setup_json').notNull(),
  stateJson: text('state_json').notNull(),
  whitePlayerId: text('white_player_id'),
  blackPlayerId: text('black_player_id'),
  result: text('result'), // white | black | draw | null
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
})

export const gameEvents = sqliteTable('game_events', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull(),
  seq: integer('seq').notNull(),
  type: text('type').notNull(),
  payloadJson: text('payload_json').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const rooms = sqliteTable('rooms', {
  code: text('code').primaryKey(),
  gameId: text('game_id').notNull(),
  hostPlayerId: text('host_player_id').notNull(),
  status: text('status').notNull(), // open | full | closed
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})
