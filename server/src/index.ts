import { createServer } from 'node:http'
import { WebSocketServer, type WebSocket } from 'ws'
import {
  parseClientMessage,
  type ServerMessage,
} from '../../src/online/protocol.ts'
import {
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
} from './roomManager.ts'
import './db/index.ts'

const PORT = Number(process.env.PORT ?? 3001)

type Sock = WebSocket & { playerId?: string }

function reply(socket: WebSocket, message: ServerMessage) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message))
  }
}

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }
  res.writeHead(404)
  res.end('Not found')
})

const wss = new WebSocketServer({ server })

wss.on('connection', (socket: Sock) => {
  socket.on('message', (data) => {
    const raw = typeof data === 'string' ? data : data.toString()
    const msg = parseClientMessage(raw)
    if (!msg) {
      reply(socket, {
        type: 'error',
        code: 'bad_message',
        message: 'Invalid message.',
      })
      return
    }

    if (msg.type === 'hello') {
      socket.playerId = msg.playerId
      bindSocket(socket, msg.playerId)
      reply(socket, { type: 'hello:ok', playerId: msg.playerId })
      return
    }

    const playerId = socket.playerId
    if (!playerId) {
      reply(socket, {
        type: 'error',
        code: 'not_hello',
        message: 'Send hello first.',
      })
      return
    }

    switch (msg.type) {
      case 'room:create':
        {
          const result = createRoom(
            playerId,
            msg.size,
            msg.timeControl,
            msg.mode,
            msg.preferredColor,
          )
          if (result.type === 'error') reply(socket, result)
        }
        break
      case 'room:join':
        {
          const result = joinRoom(playerId, msg.code)
          if (result.type === 'error') reply(socket, result)
        }
        break
      case 'room:leave':
        leaveRooms(playerId)
        break
      case 'draft:place':
        {
          const result = draftPlace(playerId, msg.square, msg.pieceType)
          if (result.type === 'error') reply(socket, result)
        }
        break
      case 'draft:clear':
        {
          const result = draftClear(playerId)
          if (result.type === 'error') reply(socket, result)
        }
        break
      case 'draft:confirm':
        {
          const result = draftConfirm(playerId)
          if (result.type === 'error') reply(socket, result)
        }
        break
      case 'draft:unconfirm':
        {
          const result = draftUnconfirm(playerId)
          if (result.type === 'error') reply(socket, result)
        }
        break
      case 'move':
        {
          const result = playMove(
            playerId,
            msg.from,
            msg.to,
            msg.promotion,
          )
          if (result.type === 'error') reply(socket, result)
        }
        break
      case 'resign':
        {
          const result = playResign(playerId)
          if (result.type === 'error') reply(socket, result)
        }
        break
      default:
        reply(socket, {
          type: 'error',
          code: 'unknown',
          message: 'Unknown message type.',
        })
    }
  })

  socket.on('close', () => {
    unbindSocket(socket)
  })
})

server.listen(PORT, () => {
  console.log(`Chess server listening on http://localhost:${PORT}`)
})
