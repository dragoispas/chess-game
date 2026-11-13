import { useEffect, useState } from 'react'
import type {
  ConnectionStatus,
  OnlineSocket,
} from '../online/socket.ts'

export function useConnectionStatus(socket: OnlineSocket): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(() =>
    socket.getStatus(),
  )

  useEffect(() => socket.subscribeConnection(setStatus), [socket])

  return status
}

export function connectionStatusLabel(status: ConnectionStatus): string | null {
  switch (status) {
    case 'connecting':
      return 'Connecting…'
    case 'reconnecting':
      return 'Connection lost — reconnecting…'
    case 'disconnected':
      return 'Disconnected — trying to reconnect…'
    case 'connected':
      return null
  }
}
