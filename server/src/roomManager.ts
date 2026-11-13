/**
 * Public API for the game server. Implementation lives in `./rooms/`.
 * Kept as a stable import path for `server/src/index.ts`.
 */
export {
  bindSocket,
  createRoom,
  draftClear,
  draftConfirm,
  draftPlace,
  draftUnconfirm,
  joinRoom,
  leaveRooms,
  playMove,
  playResign,
  unbindSocket,
} from './rooms/index.ts'
