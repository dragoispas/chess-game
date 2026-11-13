const STORAGE_KEY = 'chess.playerId'

/**
 * Per-tab guest id (sessionStorage) so two windows on the same machine
 * can play each other. localStorage would make Join reattach as the host.
 */
export function getPlayerId(): string {
  const existing = sessionStorage.getItem(STORAGE_KEY)
  if (existing) return existing
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `p-${Date.now()}-${Math.random().toString(16).slice(2)}`
  sessionStorage.setItem(STORAGE_KEY, id)
  return id
}
