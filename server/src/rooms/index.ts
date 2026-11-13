/** Online room orchestration — split by concern under `./rooms/`. */

export {
  bindSocket,
  createRoom,
  joinRoom,
  unbindSocket,
} from './lifecycle.ts'
export { leaveRooms } from './sync.ts'
export {
  draftClear,
  draftConfirm,
  draftPlace,
  draftUnconfirm,
} from './draft.ts'
export { playMove, playResign } from './play.ts'
