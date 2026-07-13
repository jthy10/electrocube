import type { CubeColor, LeaderboardEntry } from './types'

const STORAGE_KEY = 'electrocube-leaderboard-v1'
const STORAGE_VERSION = 1
const MAX_STORED_RUNS = 40

interface StoredLeaderboard {
  version: typeof STORAGE_VERSION
  entries: LeaderboardEntry[]
}

export interface LeaderboardScore {
  name: string
  score: number
  color: CubeColor
  combo: number
  createdAt?: number
}

export interface LeaderboardResult {
  entry: LeaderboardEntry
  rank: number
  leaderboard: LeaderboardEntry[]
}

export type LeaderboardListener = (entries: LeaderboardEntry[]) => void

const COLORS: readonly CubeColor[] = ['cyan', 'magenta', 'violet', 'lime', 'amber']

/** Permanent rivals give a fresh install a leaderboard worth chasing. */
export const SEEDED_LEGENDS: readonly LeaderboardEntry[] = Object.freeze([
  { id: 'legend-arc-angel', name: 'ARC ANGEL', score: 128_600, color: 'cyan', combo: 38, createdAt: 1 },
  { id: 'legend-kira-404', name: 'KIRA_404', score: 112_450, color: 'magenta', combo: 34, createdAt: 2 },
  { id: 'legend-voidrunner', name: 'VOIDRUNNER', score: 96_800, color: 'violet', combo: 30, createdAt: 3 },
  { id: 'legend-ghost-volt', name: 'GHOST VOLT', score: 81_250, color: 'lime', combo: 27, createdAt: 4 },
  { id: 'legend-cube-zero', name: 'CUBE ZERO', score: 68_900, color: 'amber', combo: 23, createdAt: 5 },
  { id: 'legend-nova-kid', name: 'NOVA//KID', score: 54_300, color: 'cyan', combo: 19, createdAt: 6 },
])

const listeners = new Set<LeaderboardListener>()

const isCubeColor = (value: unknown): value is CubeColor =>
  typeof value === 'string' && COLORS.includes(value as CubeColor)

const cleanName = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9_\- /]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 14) || 'ROOKIE'

const cleanInteger = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0)

const isLeaderboardEntry = (value: unknown): value is LeaderboardEntry => {
  if (typeof value !== 'object' || value === null) return false

  const entry = value as Partial<LeaderboardEntry>
  return (
    typeof entry.id === 'string' &&
    typeof entry.name === 'string' &&
    typeof entry.score === 'number' &&
    Number.isFinite(entry.score) &&
    isCubeColor(entry.color) &&
    typeof entry.combo === 'number' &&
    Number.isFinite(entry.combo) &&
    typeof entry.createdAt === 'number' &&
    Number.isFinite(entry.createdAt)
  )
}

const compareEntries = (left: LeaderboardEntry, right: LeaderboardEntry) =>
  right.score - left.score || right.combo - left.combo || left.createdAt - right.createdAt

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

const readPlayerEntries = (): LeaderboardEntry[] => {
  const storage = getStorage()
  if (!storage) return []

  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as Partial<StoredLeaderboard>
    if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.entries)) return []

    return parsed.entries
      .filter(isLeaderboardEntry)
      .map((entry) => ({
        ...entry,
        name: cleanName(entry.name),
        score: cleanInteger(entry.score),
        combo: cleanInteger(entry.combo),
        isPlayer: true,
      }))
      .sort(compareEntries)
      .slice(0, MAX_STORED_RUNS)
  } catch {
    return []
  }
}

const writePlayerEntries = (entries: LeaderboardEntry[]) => {
  const storage = getStorage()
  if (!storage) return

  const payload: StoredLeaderboard = {
    version: STORAGE_VERSION,
    entries: entries.sort(compareEntries).slice(0, MAX_STORED_RUNS),
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // A full or privacy-restricted localStorage should not interrupt the game.
  }
}

const createEntryId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `run-${crypto.randomUUID()}`
  }

  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

const notifyListeners = () => {
  if (listeners.size === 0) return
  const entries = getLeaderboard()
  listeners.forEach((listener) => listener(entries))
}

/** Returns ranked legends and locally saved player runs. */
export const getLeaderboard = (limit = 10): LeaderboardEntry[] => {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 10
  return [...SEEDED_LEGENDS.map((entry) => ({ ...entry })), ...readPlayerEntries()]
    .sort(compareEntries)
    .slice(0, safeLimit)
}

/** Saves a completed run and returns its overall rank. */
export const recordScore = (score: LeaderboardScore): LeaderboardResult => {
  const entry: LeaderboardEntry = {
    id: createEntryId(),
    name: cleanName(score.name),
    score: cleanInteger(score.score),
    color: score.color,
    combo: cleanInteger(score.combo),
    createdAt:
      score.createdAt !== undefined && Number.isFinite(score.createdAt)
        ? Math.max(0, Math.floor(score.createdAt))
        : Date.now(),
    isPlayer: true,
  }

  const rankedPlayerEntries = [...readPlayerEntries(), entry].sort(compareEntries)
  const completeRanking = [...SEEDED_LEGENDS.map((legend) => ({ ...legend })), ...rankedPlayerEntries]
    .sort(compareEntries)
  const rank = completeRanking.findIndex((candidate) => candidate.id === entry.id) + 1
  const playerEntries = rankedPlayerEntries.slice(0, MAX_STORED_RUNS)
  writePlayerEntries(playerEntries)

  const completeLeaderboard = getLeaderboard(Number.MAX_SAFE_INTEGER)
  notifyListeners()

  return { entry, rank, leaderboard: completeLeaderboard.slice(0, 10) }
}

/** Alias that reads naturally at game-over call sites. */
export const submitScore = recordScore

export const getPlayerBest = (name?: string): LeaderboardEntry | null => {
  const targetName = name ? cleanName(name) : null
  return (
    readPlayerEntries()
      .filter((entry) => targetName === null || entry.name === targetName)
      .sort(compareEntries)[0] ?? null
  )
}

export const clearPlayerScores = () => {
  const storage = getStorage()
  try {
    storage?.removeItem(STORAGE_KEY)
  } catch {
    // Ignore privacy and quota errors, matching read/write behavior.
  }
  notifyListeners()
}

/** Observes leaderboard changes in this tab and in other tabs. */
export const subscribeLeaderboard = (listener: LeaderboardListener): (() => void) => {
  listeners.add(listener)

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener(getLeaderboard())
  }

  if (typeof window !== 'undefined') window.addEventListener('storage', handleStorage)

  return () => {
    listeners.delete(listener)
    if (typeof window !== 'undefined') window.removeEventListener('storage', handleStorage)
  }
}
