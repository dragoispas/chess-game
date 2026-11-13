import type { BoardSize } from '../types.ts'
import variantsIni from './variants.ini?raw'
import { variantNameForSize } from './uci.ts'

const ASSET_BASE = '/fairy-stockfish'
const MOVE_TIME_MS = 1500
const READY_TIMEOUT_MS = 20_000
const SEARCH_TIMEOUT_MS = 15_000
const VARIANT_EOF = 'ENDINTERVIEWVARIANTS'

type StockfishEngine = {
  postMessage: (cmd: string) => void
  addMessageListener: (cb: (line: string) => void) => void
  removeMessageListener: (cb: (line: string) => void) => void
  terminate: () => void
  FS?: {
    writeFile: (path: string, data: string | Uint8Array) => void
  }
}

type StockfishFactory = (opts?: {
  locateFile?: (path: string) => string
}) => Promise<StockfishEngine>

declare global {
  interface Window {
    Stockfish?: StockfishFactory
  }
}

let enginePromise: Promise<StockfishEngine> | null = null
let activeVariant: string | null = null
let searchGeneration = 0
let scriptPromise: Promise<StockfishFactory> | null = null
let variantsLoaded = false

function locateFile(path: string): string {
  if (path.endsWith('.wasm')) return `${ASSET_BASE}/stockfish.wasm`
  if (path.endsWith('.worker.js')) return `${ASSET_BASE}/stockfish.worker.js`
  return `${ASSET_BASE}/${path}`
}

function waitForLine(
  engine: StockfishEngine,
  predicate: (line: string) => boolean,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      engine.removeMessageListener(onLine)
      reject(new Error('Fairy-Stockfish timed out'))
    }, timeoutMs)

    function onLine(line: string) {
      if (!predicate(line)) return
      window.clearTimeout(timer)
      engine.removeMessageListener(onLine)
      resolve(line)
    }

    engine.addMessageListener(onLine)
  })
}

function collectUntil(
  engine: StockfishEngine,
  predicate: (line: string) => boolean,
  timeoutMs: number,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const lines: string[] = []
    const timer = window.setTimeout(() => {
      engine.removeMessageListener(onLine)
      reject(new Error('Fairy-Stockfish timed out'))
    }, timeoutMs)

    function onLine(line: string) {
      lines.push(line)
      if (!predicate(line)) return
      window.clearTimeout(timer)
      engine.removeMessageListener(onLine)
      resolve(lines)
    }

    engine.addMessageListener(onLine)
  })
}

function loadStockfishFactory(): Promise<StockfishFactory> {
  if (window.Stockfish) return Promise.resolve(window.Stockfish)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<StockfishFactory>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-fairy-stockfish]',
    )
    if (existing && window.Stockfish) {
      resolve(window.Stockfish)
      return
    }

    const script = document.createElement('script')
    script.src = `${ASSET_BASE}/stockfish.js`
    script.async = true
    script.dataset.fairyStockfish = '1'
    script.onload = () => {
      if (!window.Stockfish) {
        reject(new Error('Fairy-Stockfish did not expose window.Stockfish'))
        return
      }
      resolve(window.Stockfish)
    }
    script.onerror = () =>
      reject(new Error('Failed to load Fairy-Stockfish script'))
    document.head.appendChild(script)
  }).catch((err) => {
    scriptPromise = null
    throw err
  })

  return scriptPromise
}

async function variantsRegistered(engine: StockfishEngine): Promise<boolean> {
  const uciLines = collectUntil(
    engine,
    (line) => line === 'uciok',
    READY_TIMEOUT_MS,
  )
  engine.postMessage('uci')
  const lines = await uciLines
  const variantOption = lines.find((line) =>
    line.startsWith('option name UCI_Variant'),
  )
  return (
    !!variantOption?.includes('interview6') &&
    !!variantOption?.includes('interview8') &&
    !!variantOption?.includes('interview10')
  )
}

async function flushReady(engine: StockfishEngine): Promise<void> {
  const ready = waitForLine(engine, (line) => line === 'readyok', READY_TIMEOUT_MS)
  engine.postMessage('isready')
  await ready
}

function postHeredocLoad(engine: StockfishEngine, ini: string): void {
  // Fairy-Stockfish heredoc: `load <<MARKER` … lines … `MARKER`
  engine.postMessage(`load <<${VARIANT_EOF}`)
  for (const line of ini.split('\n')) {
    engine.postMessage(line)
  }
  engine.postMessage(VARIANT_EOF)
}

/** Register custom interview* variants. Prefer MEMFS file load; fall back to heredoc. */
async function loadVariants(engine: StockfishEngine): Promise<void> {
  if (variantsLoaded) return

  const ini = variantsIni.trim()

  if (engine.FS?.writeFile) {
    try {
      engine.FS.writeFile('/interview-variants.ini', ini)
      engine.postMessage('load /interview-variants.ini')
      await flushReady(engine)
      if (await variantsRegistered(engine)) {
        variantsLoaded = true
        return
      }
      console.warn(
        '[fairy-stockfish] MEMFS load did not register variants; trying heredoc',
      )
    } catch (err) {
      console.warn('[fairy-stockfish] MEMFS load failed; trying heredoc', err)
    }
  }

  postHeredocLoad(engine, ini)
  await flushReady(engine)
  if (!(await variantsRegistered(engine))) {
    throw new Error(
      'Fairy-Stockfish variants failed to load (interview6/8/10 missing)',
    )
  }

  variantsLoaded = true
}

async function createEngine(): Promise<StockfishEngine> {
  const Stockfish = await loadStockfishFactory()
  const engine = await Stockfish({ locateFile })

  const uciDone = waitForLine(engine, (line) => line === 'uciok', READY_TIMEOUT_MS)
  engine.postMessage('uci')
  await uciDone

  await loadVariants(engine)

  engine.postMessage('setoption name Threads value 1')
  engine.postMessage('setoption name Hash value 64')
  const ready = waitForLine(engine, (line) => line === 'readyok', READY_TIMEOUT_MS)
  engine.postMessage('isready')
  await ready

  return engine
}

function getEngine(): Promise<StockfishEngine> {
  if (!enginePromise) {
    enginePromise = createEngine().catch((err) => {
      enginePromise = null
      variantsLoaded = false
      activeVariant = null
      throw err
    })
  }
  return enginePromise
}

async function ensureVariant(
  engine: StockfishEngine,
  size: BoardSize,
): Promise<void> {
  const name = variantNameForSize(size)
  if (activeVariant === name) return
  engine.postMessage(`setoption name UCI_Variant value ${name}`)
  const ready = waitForLine(engine, (line) => line === 'readyok', READY_TIMEOUT_MS)
  engine.postMessage('isready')
  await ready
  activeVariant = name
}

/**
 * Ask Fairy-Stockfish for the best move among `searchmoves`.
 * Returns a UCI string, or null on failure / empty search.
 */
export async function getBestUciMove(options: {
  fen: string
  size: BoardSize
  searchmoves: string[]
  movetimeMs?: number
}): Promise<string | null> {
  const { fen, size, searchmoves, movetimeMs = MOVE_TIME_MS } = options
  if (searchmoves.length === 0) return null

  const generation = ++searchGeneration

  try {
    const engine = await getEngine()
    if (generation !== searchGeneration) return null

    await ensureVariant(engine, size)
    if (generation !== searchGeneration) return null

    engine.postMessage('stop')
    engine.postMessage(`position fen ${fen}`)

    const go = `go movetime ${movetimeMs} searchmoves ${searchmoves.join(' ')}`
    const bestLine = waitForLine(
      engine,
      (line) => line.startsWith('bestmove '),
      SEARCH_TIMEOUT_MS,
    )
    engine.postMessage(go)
    const line = await bestLine
    if (generation !== searchGeneration) return null

    const parts = line.split(/\s+/)
    const move = parts[1]
    if (!move || move === '(none)' || move === '0000') return null
    return move
  } catch (err) {
    console.warn('[fairy-stockfish] search failed', err)
    return null
  }
}

/** Cancel an in-flight search so a newer request can take over. */
export function cancelStockfishSearch(): void {
  searchGeneration += 1
  void enginePromise?.then((engine) => {
    try {
      engine.postMessage('stop')
    } catch {
      /* ignore */
    }
  })
}

export function disposeStockfish(): void {
  cancelStockfishSearch()
  void enginePromise?.then((engine) => {
    try {
      engine.terminate()
    } catch {
      /* ignore */
    }
  })
  enginePromise = null
  activeVariant = null
  variantsLoaded = false
}
