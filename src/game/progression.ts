import type { GameMode, RunSummary } from './types'

export const PROGRESSION_STORAGE_KEY = 'electrocube-progression-v1'
export const PROGRESSION_VERSION = 1 as const
export const MAX_LEVEL = 50

const MAX_PERSISTED_XP = 1_000_000_000
const MAX_STAT_VALUE = 1_000_000_000_000
const DUEL_WIN_XP = 200
const DEFAULT_TRAIL_ID: TrailId = 'ion-wake'

export type RankTierId = 'flux' | 'arc' | 'ion' | 'neon' | 'plasma' | 'singularity'

export interface RankTierDefinition {
  id: RankTierId
  label: string
  minLevel: number
  primaryColor: string
  secondaryColor: string
}

export const RANK_TIERS = [
  { id: 'flux', label: 'Flux Initiate', minLevel: 1, primaryColor: '#00f6ff', secondaryColor: '#4b6cff' },
  { id: 'arc', label: 'Arc Runner', minLevel: 5, primaryColor: '#6fe8ff', secondaryColor: '#985dff' },
  { id: 'ion', label: 'Ion Vanguard', minLevel: 10, primaryColor: '#a8ff36', secondaryColor: '#00e6a7' },
  { id: 'neon', label: 'Neon Elite', minLevel: 18, primaryColor: '#ff2bd6', secondaryColor: '#7c3cff' },
  { id: 'plasma', label: 'Plasma Legend', minLevel: 28, primaryColor: '#ffba38', secondaryColor: '#ff4d6d' },
  { id: 'singularity', label: 'Singularity', minLevel: 40, primaryColor: '#ffffff', secondaryColor: '#00f6ff' },
] as const satisfies readonly RankTierDefinition[]

export interface PlayerStats {
  runs: number
  totalScore: number
  wins: number
  bestCombo: number
  shards: number
  banks: number
  drones: number
}

export type AchievementId =
  | 'first-surge'
  | 'five-digit-signal'
  | 'chain-reaction'
  | 'shardstorm'
  | 'core-banker'
  | 'drone-breaker'
  | 'duel-crowned'
  | 'grid-veteran'
  | 'quarter-megavolt'
  | 'triple-bank'

export type AchievementRequirement =
  | { kind: 'stat'; stat: keyof PlayerStats; target: number }
  | { kind: 'run'; stat: keyof Pick<RunSummary, 'score' | 'bestCombo' | 'shards' | 'banks' | 'drones'>; target: number }
  | { kind: 'duel-win' }

export interface AchievementDefinition {
  id: AchievementId
  title: string
  description: string
  rewardXp: number
  requirement: AchievementRequirement
}

export const ACHIEVEMENTS = [
  {
    id: 'first-surge',
    title: 'Core Online',
    description: 'Complete your first arena run.',
    rewardXp: 100,
    requirement: { kind: 'stat', stat: 'runs', target: 1 },
  },
  {
    id: 'five-digit-signal',
    title: 'Five-Digit Signal',
    description: 'Score 10,000 points in a single run.',
    rewardXp: 250,
    requirement: { kind: 'run', stat: 'score', target: 10_000 },
  },
  {
    id: 'chain-reaction',
    title: 'Chain Reaction',
    description: 'Reach a combo of 10 or higher.',
    rewardXp: 200,
    requirement: { kind: 'stat', stat: 'bestCombo', target: 10 },
  },
  {
    id: 'shardstorm',
    title: 'Shardstorm',
    description: 'Collect 100 charge shards across all runs.',
    rewardXp: 300,
    requirement: { kind: 'stat', stat: 'shards', target: 100 },
  },
  {
    id: 'core-banker',
    title: 'Core Banker',
    description: 'Bank charge 25 times.',
    rewardXp: 350,
    requirement: { kind: 'stat', stat: 'banks', target: 25 },
  },
  {
    id: 'drone-breaker',
    title: 'Drone Breaker',
    description: 'Destroy 50 hostile drones.',
    rewardXp: 350,
    requirement: { kind: 'stat', stat: 'drones', target: 50 },
  },
  {
    id: 'duel-crowned',
    title: 'Duel Crowned',
    description: 'Win a head-to-head arena duel.',
    rewardXp: 400,
    requirement: { kind: 'duel-win' },
  },
  {
    id: 'grid-veteran',
    title: 'Grid Veteran',
    description: 'Complete 25 arena runs.',
    rewardXp: 500,
    requirement: { kind: 'stat', stat: 'runs', target: 25 },
  },
  {
    id: 'quarter-megavolt',
    title: 'Quarter Megavolt',
    description: 'Accumulate 250,000 signal score.',
    rewardXp: 750,
    requirement: { kind: 'stat', stat: 'totalScore', target: 250_000 },
  },
  {
    id: 'triple-bank',
    title: 'Capacitor Greed',
    description: 'Bank charge at least three times in one run.',
    rewardXp: 225,
    requirement: { kind: 'run', stat: 'banks', target: 3 },
  },
] as const satisfies readonly AchievementDefinition[]

export type TrailId =
  | 'ion-wake'
  | 'nova-slipstream'
  | 'acid-current'
  | 'solar-breaker'
  | 'prism-phase'
  | 'void-ribbon'
  | 'apex-spectrum'

export type TrailUnlockRequirement =
  | { kind: 'default' }
  | { kind: 'level'; level: number }
  | { kind: 'achievement'; achievementId: AchievementId }
  | { kind: 'stat'; stat: keyof PlayerStats; target: number }

export interface TrailDefinition {
  id: TrailId
  label: string
  description: string
  colors: readonly [string, string]
  unlock: TrailUnlockRequirement
}

export const TRAILS = [
  {
    id: 'ion-wake',
    label: 'Ion Wake',
    description: 'The signature cyan-blue reactor trail.',
    colors: ['#00f6ff', '#4b6cff'],
    unlock: { kind: 'default' },
  },
  {
    id: 'nova-slipstream',
    label: 'Nova Slipstream',
    description: 'A vivid magenta-violet wake.',
    colors: ['#ff2bd6', '#7c3cff'],
    unlock: { kind: 'level', level: 4 },
  },
  {
    id: 'acid-current',
    label: 'Acid Current',
    description: 'A volatile lime and mint discharge.',
    colors: ['#a8ff36', '#00e6a7'],
    unlock: { kind: 'level', level: 8 },
  },
  {
    id: 'solar-breaker',
    label: 'Solar Breaker',
    description: 'A molten amber-red capacitor streak.',
    colors: ['#ffba38', '#ff4d6d'],
    unlock: { kind: 'achievement', achievementId: 'core-banker' },
  },
  {
    id: 'prism-phase',
    label: 'Prism Phase',
    description: 'Split-spectrum cyan and hot pink.',
    colors: ['#4dfcff', '#ff5de4'],
    unlock: { kind: 'level', level: 15 },
  },
  {
    id: 'void-ribbon',
    label: 'Void Ribbon',
    description: 'A deep ultraviolet trail earned through combat.',
    colors: ['#985dff', '#2ed8ff'],
    unlock: { kind: 'stat', stat: 'drones', target: 100 },
  },
  {
    id: 'apex-spectrum',
    label: 'Apex Spectrum',
    description: 'White-hot singularity light with a cyan fringe.',
    colors: ['#ffffff', '#00f6ff'],
    unlock: { kind: 'level', level: 40 },
  },
] as const satisfies readonly TrailDefinition[]

export interface LevelProgress {
  currentLevelXp: number
  nextLevelXp: number | null
  xpIntoLevel: number
  xpForNextLevel: number
  percent: number
}

export interface PlayerProgression {
  version: typeof PROGRESSION_VERSION
  xp: number
  level: number
  rankTier: RankTierId
  stats: PlayerStats
  unlockedTrailIds: TrailId[]
  selectedTrailId: TrailId
  unlockedAchievementIds: AchievementId[]
  updatedAt: number
}

export interface CompletedRun extends RunSummary {
  mode: GameMode
}

export interface RecordRunResult {
  previous: PlayerProgression
  progression: PlayerProgression
  runXp: number
  achievementXp: number
  xpEarned: number
  levelsGained: number
  rankChanged: boolean
  newlyUnlockedAchievements: AchievementDefinition[]
  newlyUnlockedTrails: TrailDefinition[]
}

const achievementIds = new Set<AchievementId>(ACHIEVEMENTS.map(({ id }) => id))
const trailIds = new Set<TrailId>(TRAILS.map(({ id }) => id))
let memoryProgression: PlayerProgression | null = null

const emptyStats = (): PlayerStats => ({
  runs: 0,
  totalScore: 0,
  wins: 0,
  bestCombo: 0,
  shards: 0,
  banks: 0,
  drones: 0,
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const safeInteger = (value: unknown, maximum = MAX_STAT_VALUE): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.min(maximum, Math.max(0, Math.floor(value)))
}

const safeSum = (left: number, right: number, maximum = MAX_STAT_VALUE) =>
  Math.min(maximum, safeInteger(left, maximum) + safeInteger(right, maximum))

const getBrowserStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function xpRequiredForLevel(level: number): number {
  const normalizedLevel = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)))
  const completedLevels = normalizedLevel - 1
  return 250 * completedLevels + 75 * completedLevels * Math.max(0, completedLevels - 1)
}

export function getLevelFromXp(xp: number): number {
  const normalizedXp = safeInteger(xp, MAX_PERSISTED_XP)
  let low = 1
  let high = MAX_LEVEL

  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (xpRequiredForLevel(middle) <= normalizedXp) low = middle
    else high = middle - 1
  }

  return low
}

export function getLevelProgress(xp: number): LevelProgress {
  const normalizedXp = safeInteger(xp, MAX_PERSISTED_XP)
  const level = getLevelFromXp(normalizedXp)
  const currentLevelXp = xpRequiredForLevel(level)
  const nextLevelXp = level >= MAX_LEVEL ? null : xpRequiredForLevel(level + 1)
  const xpForNextLevel = nextLevelXp === null ? 0 : nextLevelXp - currentLevelXp
  const xpIntoLevel = nextLevelXp === null ? 0 : Math.min(xpForNextLevel, normalizedXp - currentLevelXp)

  return {
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel,
    xpForNextLevel,
    percent: nextLevelXp === null ? 100 : Math.min(100, (xpIntoLevel / xpForNextLevel) * 100),
  }
}

export function getRankTier(level: number): RankTierDefinition {
  const normalizedLevel = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)))
  for (let index = RANK_TIERS.length - 1; index >= 0; index -= 1) {
    const tier = RANK_TIERS[index]
    if (normalizedLevel >= tier.minLevel) return tier
  }
  return RANK_TIERS[0]
}

export function createDefaultProgression(): PlayerProgression {
  return {
    version: PROGRESSION_VERSION,
    xp: 0,
    level: 1,
    rankTier: 'flux',
    stats: emptyStats(),
    unlockedTrailIds: [DEFAULT_TRAIL_ID],
    selectedTrailId: DEFAULT_TRAIL_ID,
    unlockedAchievementIds: [],
    updatedAt: 0,
  }
}

const readStats = (value: unknown): PlayerStats => {
  if (!isRecord(value)) return emptyStats()
  return {
    runs: safeInteger(value.runs),
    totalScore: safeInteger(value.totalScore),
    wins: safeInteger(value.wins),
    bestCombo: safeInteger(value.bestCombo),
    shards: safeInteger(value.shards),
    banks: safeInteger(value.banks),
    drones: safeInteger(value.drones),
  }
}

const readKnownIds = <Id extends string>(value: unknown, knownIds: ReadonlySet<Id>): Id[] => {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((entry): entry is Id => typeof entry === 'string' && knownIds.has(entry as Id)))]
}

const trailIsUnlocked = (
  trail: TrailDefinition,
  level: number,
  stats: PlayerStats,
  achievements: ReadonlySet<AchievementId>,
) => {
  switch (trail.unlock.kind) {
    case 'default':
      return true
    case 'level':
      return level >= trail.unlock.level
    case 'achievement':
      return achievements.has(trail.unlock.achievementId)
    case 'stat':
      return stats[trail.unlock.stat] >= trail.unlock.target
  }
}

export function normalizeProgression(value: unknown): PlayerProgression {
  const record = isRecord(value) ? value : {}
  const xp = safeInteger(record.xp, MAX_PERSISTED_XP)
  const level = getLevelFromXp(xp)
  const stats = readStats(record.stats)
  const unlockedAchievementIds = readKnownIds(record.unlockedAchievementIds, achievementIds)
  const achievementSet = new Set(unlockedAchievementIds)
  const persistedTrails = readKnownIds(record.unlockedTrailIds, trailIds)
  const eligibleTrails = TRAILS.filter((trail) => trailIsUnlocked(trail, level, stats, achievementSet)).map(
    ({ id }) => id,
  )
  const unlockedTrailIds = [...new Set<TrailId>([DEFAULT_TRAIL_ID, ...persistedTrails, ...eligibleTrails])]
  const selectedTrailId =
    typeof record.selectedTrailId === 'string' &&
    trailIds.has(record.selectedTrailId as TrailId) &&
    unlockedTrailIds.includes(record.selectedTrailId as TrailId)
      ? (record.selectedTrailId as TrailId)
      : DEFAULT_TRAIL_ID

  return {
    version: PROGRESSION_VERSION,
    xp,
    level,
    rankTier: getRankTier(level).id,
    stats,
    unlockedTrailIds,
    selectedTrailId,
    unlockedAchievementIds,
    updatedAt: safeInteger(record.updatedAt, Number.MAX_SAFE_INTEGER),
  }
}

const persistProgression = (progression: PlayerProgression, storage: Storage | null) => {
  memoryProgression = progression
  if (!storage) return
  try {
    storage.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(progression))
  } catch {
    // Storage can be blocked, full, or unavailable in privacy contexts. The in-memory snapshot remains usable.
  }
}

export function readProgression(storage: Storage | null = getBrowserStorage()): PlayerProgression {
  if (storage) {
    try {
      const serialized = storage.getItem(PROGRESSION_STORAGE_KEY)
      if (serialized) {
        const progression = normalizeProgression(JSON.parse(serialized) as unknown)
        memoryProgression = progression
        return progression
      }
    } catch {
      // Invalid JSON and restricted storage both fall through to the safe session snapshot.
    }
  }

  const progression = memoryProgression ? normalizeProgression(memoryProgression) : createDefaultProgression()
  memoryProgression = progression
  return progression
}

export function saveProgression(
  value: PlayerProgression,
  storage: Storage | null = getBrowserStorage(),
): PlayerProgression {
  const progression = normalizeProgression(value)
  persistProgression(progression, storage)
  return progression
}

const normalizeRun = (run: CompletedRun): CompletedRun => ({
  mode: run.mode === 'duel' ? 'duel' : 'solo',
  score: safeInteger(run.score),
  bestCombo: safeInteger(run.bestCombo),
  shards: safeInteger(run.shards),
  banks: safeInteger(run.banks),
  drones: safeInteger(run.drones),
  duration: safeInteger(run.duration, 86_400),
  won: run.won === true,
})

export function calculateRunXp(run: CompletedRun): number {
  const normalized = normalizeRun(run)
  const earned =
    100 +
    Math.min(1_500, Math.floor(normalized.score / 80)) +
    Math.min(500, normalized.shards * 4) +
    Math.min(600, normalized.banks * 35) +
    Math.min(600, normalized.drones * 12) +
    Math.min(400, normalized.bestCombo * 8) +
    (normalized.mode === 'duel' && normalized.won ? DUEL_WIN_XP : 0)
  return Math.min(3_500, earned)
}

const achievementIsUnlocked = (
  achievement: AchievementDefinition,
  stats: PlayerStats,
  run: CompletedRun,
) => {
  switch (achievement.requirement.kind) {
    case 'stat':
      return stats[achievement.requirement.stat] >= achievement.requirement.target
    case 'run':
      return run[achievement.requirement.stat] >= achievement.requirement.target
    case 'duel-win':
      return run.mode === 'duel' && run.won === true
  }
}

export function recordCompletedRun(
  completedRun: CompletedRun,
  storage: Storage | null = getBrowserStorage(),
): RecordRunResult {
  const run = normalizeRun(completedRun)
  const previous = readProgression(storage)
  const stats: PlayerStats = {
    runs: safeSum(previous.stats.runs, 1),
    totalScore: safeSum(previous.stats.totalScore, run.score),
    wins: safeSum(previous.stats.wins, run.mode === 'duel' && run.won ? 1 : 0),
    bestCombo: Math.max(previous.stats.bestCombo, run.bestCombo),
    shards: safeSum(previous.stats.shards, run.shards),
    banks: safeSum(previous.stats.banks, run.banks),
    drones: safeSum(previous.stats.drones, run.drones),
  }

  const previousAchievements = new Set(previous.unlockedAchievementIds)
  const newlyUnlockedAchievements = ACHIEVEMENTS.filter(
    (achievement) => !previousAchievements.has(achievement.id) && achievementIsUnlocked(achievement, stats, run),
  )
  const unlockedAchievementIds = [
    ...previous.unlockedAchievementIds,
    ...newlyUnlockedAchievements.map(({ id }) => id),
  ]
  const achievementXp = newlyUnlockedAchievements.reduce((total, achievement) => total + achievement.rewardXp, 0)
  const runXp = calculateRunXp(run)
  const xp = Math.min(MAX_PERSISTED_XP, previous.xp + runXp + achievementXp)
  const level = getLevelFromXp(xp)
  const achievementSet = new Set(unlockedAchievementIds)
  const previousTrails = new Set(previous.unlockedTrailIds)
  const eligibleTrails = TRAILS.filter((trail) => trailIsUnlocked(trail, level, stats, achievementSet))
  const newlyUnlockedTrails = eligibleTrails.filter((trail) => !previousTrails.has(trail.id))
  const unlockedTrailIds = [
    ...previous.unlockedTrailIds,
    ...newlyUnlockedTrails.map(({ id }) => id),
  ]

  const progression: PlayerProgression = {
    version: PROGRESSION_VERSION,
    xp,
    level,
    rankTier: getRankTier(level).id,
    stats,
    unlockedTrailIds,
    selectedTrailId: unlockedTrailIds.includes(previous.selectedTrailId)
      ? previous.selectedTrailId
      : DEFAULT_TRAIL_ID,
    unlockedAchievementIds,
    updatedAt: Date.now(),
  }
  persistProgression(progression, storage)

  return {
    previous,
    progression,
    runXp,
    achievementXp,
    xpEarned: runXp + achievementXp,
    levelsGained: Math.max(0, progression.level - previous.level),
    rankChanged: progression.rankTier !== previous.rankTier,
    newlyUnlockedAchievements,
    newlyUnlockedTrails,
  }
}

/**
 * Applies the outcome-only portion of a duel after the local run has already
 * been archived. This keeps score/XP durable while the exact rival result is
 * still in flight, without counting the run or its collectibles twice.
 */
export function recordDuelVictory(storage: Storage | null = getBrowserStorage()): RecordRunResult {
  const previous = readProgression(storage)
  const stats: PlayerStats = {
    ...previous.stats,
    wins: safeSum(previous.stats.wins, 1),
  }
  const victoryRun: CompletedRun = {
    mode: 'duel',
    score: 0,
    bestCombo: 0,
    shards: 0,
    banks: 0,
    drones: 0,
    duration: 0,
    won: true,
  }
  const previousAchievements = new Set(previous.unlockedAchievementIds)
  const newlyUnlockedAchievements = ACHIEVEMENTS.filter(
    (achievement) => !previousAchievements.has(achievement.id) && achievementIsUnlocked(achievement, stats, victoryRun),
  )
  const unlockedAchievementIds = [
    ...previous.unlockedAchievementIds,
    ...newlyUnlockedAchievements.map(({ id }) => id),
  ]
  const runXp = DUEL_WIN_XP
  const achievementXp = newlyUnlockedAchievements.reduce((total, achievement) => total + achievement.rewardXp, 0)
  const xp = Math.min(MAX_PERSISTED_XP, previous.xp + runXp + achievementXp)
  const level = getLevelFromXp(xp)
  const achievementSet = new Set(unlockedAchievementIds)
  const previousTrails = new Set(previous.unlockedTrailIds)
  const eligibleTrails = TRAILS.filter((trail) => trailIsUnlocked(trail, level, stats, achievementSet))
  const newlyUnlockedTrails = eligibleTrails.filter((trail) => !previousTrails.has(trail.id))
  const unlockedTrailIds = [
    ...previous.unlockedTrailIds,
    ...newlyUnlockedTrails.map(({ id }) => id),
  ]
  const progression: PlayerProgression = {
    version: PROGRESSION_VERSION,
    xp,
    level,
    rankTier: getRankTier(level).id,
    stats,
    unlockedTrailIds,
    selectedTrailId: unlockedTrailIds.includes(previous.selectedTrailId)
      ? previous.selectedTrailId
      : DEFAULT_TRAIL_ID,
    unlockedAchievementIds,
    updatedAt: Date.now(),
  }
  persistProgression(progression, storage)

  return {
    previous,
    progression,
    runXp,
    achievementXp,
    xpEarned: runXp + achievementXp,
    levelsGained: Math.max(0, progression.level - previous.level),
    rankChanged: progression.rankTier !== previous.rankTier,
    newlyUnlockedAchievements,
    newlyUnlockedTrails,
  }
}

export function selectTrail(
  trailId: TrailId,
  storage: Storage | null = getBrowserStorage(),
): PlayerProgression {
  const progression = readProgression(storage)
  if (!progression.unlockedTrailIds.includes(trailId)) return progression
  return saveProgression({ ...progression, selectedTrailId: trailId, updatedAt: Date.now() }, storage)
}

export function resetProgression(storage: Storage | null = getBrowserStorage()): PlayerProgression {
  if (storage) {
    try {
      storage.removeItem(PROGRESSION_STORAGE_KEY)
    } catch {
      // Reset the in-memory progression even when browser storage cannot be modified.
    }
  }
  const progression = createDefaultProgression()
  memoryProgression = progression
  return progression
}
