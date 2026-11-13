const STORAGE_KEY = 'chess.activeOnline'

export type ActiveOnline = {
  code: string
}

function readCodes(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ActiveOnline | { codes: string[] }
    if (parsed && typeof parsed === 'object' && 'codes' in parsed) {
      return (parsed.codes ?? [])
        .filter((code): code is string => typeof code === 'string')
        .map((code) => code.toUpperCase())
    }
    // Legacy single-code shape.
    if (
      parsed &&
      typeof parsed === 'object' &&
      'code' in parsed &&
      typeof (parsed as ActiveOnline).code === 'string'
    ) {
      return [(parsed as ActiveOnline).code.toUpperCase()]
    }
    return []
  } catch {
    return []
  }
}

function writeCodes(codes: string[]) {
  const unique = [...new Set(codes.map((code) => code.toUpperCase()))]
  if (unique.length === 0) {
    sessionStorage.removeItem(STORAGE_KEY)
    return
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ codes: unique }))
}

export function getActiveOnlineRooms(): string[] {
  return readCodes()
}

/** @deprecated Prefer getActiveOnlineRooms — kept for single-card callers. */
export function getActiveOnline(): ActiveOnline | null {
  const codes = readCodes()
  const code = codes[0]
  return code ? { code } : null
}

export function setActiveOnline(session: ActiveOnline): void {
  const codes = readCodes()
  const next = session.code.toUpperCase()
  if (!codes.includes(next)) codes.push(next)
  writeCodes(codes)
}

export function removeActiveOnline(code: string): void {
  writeCodes(readCodes().filter((entry) => entry !== code.toUpperCase()))
}

export function clearActiveOnline(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}
