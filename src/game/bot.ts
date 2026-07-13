import { ARENA_RADIUS, BOT_NAMES, MAX_CHARGE, MAX_SHIELDS, RUN_DURATION } from './constants'
import type { CubeColor, RivalSnapshot } from './types'

/** The three bot pace profiles exposed by the duel UI. */
export type BotDifficulty = 'easy' | 'normal' | 'hard'

export interface BotRivalOptions {
  /** A match seed. Strings are hashed, so room codes can be passed directly. */
  seed: number | string
  difficulty?: BotDifficulty
  name?: string
  color?: CubeColor
  /** Defaults to the game's 90 second run duration. */
  duration?: number
  /** Used only to produce RivalSnapshot.updatedAt. Defaults to zero for pure output. */
  startedAt?: number
}

export interface BotRivalSampleInput {
  elapsedSeconds: number
  /** Current local score. The bot only gets a small, delayed pressure bonus from it. */
  playerScore?: number
  /** Pass Date.now() here when consumers use updatedAt as a liveness signal. */
  updatedAt?: number
}

interface DifficultyTuning {
  collectMin: number
  collectMax: number
  streakMin: number
  streakMax: number
  recoveryMin: number
  recoveryMax: number
  longRecoveryChance: number
  bankMin: number
  bankMax: number
  gateMin: number
  gateMax: number
  hitMin: number
  hitMax: number
  pulseMin: number
  pulseMax: number
  maxPulseTargets: number
  movementSpeed: number
  reactionDelay: number
  pressureResponse: number
  pressureCap: number
}

const DIFFICULTY_TUNING: Readonly<Record<BotDifficulty, DifficultyTuning>> = {
  easy: {
    collectMin: 0.96,
    collectMax: 1.48,
    streakMin: 4,
    streakMax: 9,
    recoveryMin: 1.05,
    recoveryMax: 2.35,
    longRecoveryChance: 0.38,
    bankMin: 1.35,
    bankMax: 2.35,
    gateMin: 11,
    gateMax: 18,
    hitMin: 9.5,
    hitMax: 15.5,
    pulseMin: 1.55,
    pulseMax: 2.65,
    maxPulseTargets: 1,
    movementSpeed: 0.3,
    reactionDelay: 5.5,
    pressureResponse: 0.045,
    pressureCap: 0.025,
  },
  normal: {
    collectMin: 0.68,
    collectMax: 1.08,
    streakMin: 7,
    streakMax: 15,
    recoveryMin: 0.75,
    recoveryMax: 1.85,
    longRecoveryChance: 0.25,
    bankMin: 0.85,
    bankMax: 1.65,
    gateMin: 8,
    gateMax: 13.5,
    hitMin: 14,
    hitMax: 22,
    pulseMin: 1.25,
    pulseMax: 2.1,
    maxPulseTargets: 2,
    movementSpeed: 0.37,
    reactionDelay: 4.5,
    pressureResponse: 0.06,
    pressureCap: 0.035,
  },
  hard: {
    collectMin: 0.55,
    collectMax: 0.9,
    streakMin: 9,
    streakMax: 17,
    recoveryMin: 0.75,
    recoveryMax: 1.75,
    longRecoveryChance: 0.3,
    bankMin: 0.65,
    bankMax: 1.25,
    gateMin: 6,
    gateMax: 10.5,
    hitMin: 20,
    hitMax: 31,
    pulseMin: 1.05,
    pulseMax: 1.75,
    maxPulseTargets: 3,
    movementSpeed: 0.44,
    reactionDelay: 3.75,
    pressureResponse: 0.075,
    pressureCap: 0.045,
  },
}

type BotActionKind = 'collect' | 'bank' | 'gate' | 'hit' | 'pulse'

interface BotAction {
  kind: BotActionKind
  time: number
  order: number
  pulseTargets: number
}

interface BotState {
  time: number
  score: number
  peakScore: number
  combo: number
  charge: number
  shields: number
  multiplier: number
  wave: number
  lastComboAt: number
}

interface MovementProfile {
  phaseA: number
  phaseB: number
  phaseC: number
  radiusBase: number
  radiusSwing: number
  weave: number
  speed: number
  spin: number
}

const CUBE_COLORS: readonly CubeColor[] = ['cyan', 'magenta', 'violet', 'lime', 'amber']
const COMBO_WINDOW = 3.25
const UINT32_RANGE = 4_294_967_296
const MAX_BOT_RADIUS = ARENA_RADIUS - 1.9

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const finiteOr = (value: number | undefined, fallback: number) =>
  value !== undefined && Number.isFinite(value) ? value : fallback

const hashString = (value: string): number => {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

const normalizeSeed = (seed: number | string): number => {
  if (typeof seed === 'string') return hashString(seed)
  return Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0
}

const mixSeed = (seed: number, salt: number): number => {
  let value = (seed ^ salt) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d)
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b)
  return (value ^ (value >>> 16)) >>> 0
}

const seededRandom = (seed: number) => {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) >>> 0
    let result = value
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / UINT32_RANGE
  }
}

const randomBetween = (random: () => number, minimum: number, maximum: number) =>
  minimum + (maximum - minimum) * random()

const randomInteger = (random: () => number, minimum: number, maximum: number) =>
  minimum + Math.floor(random() * (maximum - minimum + 1))

const actionPriority: Readonly<Record<BotActionKind, number>> = {
  hit: 0,
  collect: 1,
  gate: 2,
  bank: 3,
  pulse: 4,
}

const expireCombo = (state: BotState, time: number) => {
  if (state.combo > 0 && time - state.lastComboAt >= COMBO_WINDOW) {
    state.combo = 0
    state.multiplier = 1
  }
}

const initialState = (): BotState => ({
  time: 0,
  score: 0,
  peakScore: 0,
  combo: 0,
  charge: 0,
  shields: MAX_SHIELDS,
  multiplier: 1,
  wave: 1,
  lastComboAt: Number.NEGATIVE_INFINITY,
})

const applyAction = (state: BotState, action: BotAction) => {
  expireCombo(state, action.time)

  switch (action.kind) {
    case 'collect': {
      const base = 100 + Math.min(300, state.combo * 12)
      state.combo += 1
      state.lastComboAt = action.time
      state.multiplier = Math.min(5, 1 + Math.floor(state.combo / 4) * 0.5)
      state.score += Math.round(base * state.multiplier)
      state.charge = Math.min(MAX_CHARGE, state.charge + 9 + state.combo * 0.28)
      break
    }
    case 'bank':
      state.score += Math.round((1_000 + state.wave * 350) * state.multiplier)
      state.wave += 1
      state.shields = Math.min(MAX_SHIELDS, state.shields + 1)
      state.charge = Math.min(MAX_CHARGE, state.charge + 18)
      break
    case 'gate':
      state.score += Math.round(225 * state.multiplier)
      state.charge = Math.min(MAX_CHARGE, state.charge + 8)
      break
    case 'pulse':
      if (state.charge >= MAX_CHARGE) {
        state.charge = 0
        state.score += 300 + action.pulseTargets * 420
      }
      break
    case 'hit':
      state.shields = Math.max(0, state.shields - 1)
      state.combo = 0
      state.multiplier = 1
      state.lastComboAt = Number.NEGATIVE_INFINITY
      state.score = Math.max(0, state.score - 250)
      if (state.shields === 0) {
        state.shields = MAX_SHIELDS
        state.score = Math.max(0, state.score - 750)
      }
      break
  }

  state.time = action.time
  state.peakScore = Math.max(state.peakScore, state.score)
}

const makeActions = (seed: number, duration: number, tuning: DifficultyTuning): BotAction[] => {
  const random = seededRandom(mixSeed(seed, 0x5c0aeb11))
  const actions: BotAction[] = []
  let order = 0
  const addAction = (kind: BotActionKind, time: number, pulseTargets = 0) => {
    if (time <= duration) actions.push({ kind, time, order: order++, pulseTargets })
  }

  let collectAt = randomBetween(random, 0.72, 1.28)
  let streakLeft = randomInteger(random, tuning.streakMin, tuning.streakMax)
  let objectiveProgress = 0
  let objectiveTarget = 8
  let wave = 1

  while (collectAt <= duration) {
    addAction('collect', collectAt)
    objectiveProgress += 1
    streakLeft -= 1

    if (objectiveProgress >= objectiveTarget) {
      const bankAt = collectAt + randomBetween(random, tuning.bankMin, tuning.bankMax)
      addAction('bank', bankAt)
      collectAt = bankAt + randomBetween(random, 0.12, 0.42)
      wave += 1
      objectiveProgress = 0
      objectiveTarget = Math.min(15, 7 + wave)
    }

    const progress = collectAt / duration
    const lateRunPace = 1 - progress * 0.09
    collectAt += randomBetween(random, tuning.collectMin, tuning.collectMax) * lateRunPace

    if (streakLeft <= 0) {
      let recovery = randomBetween(random, tuning.recoveryMin, tuning.recoveryMax)
      if (random() < tuning.longRecoveryChance) recovery += randomBetween(random, 1.65, 2.75)
      collectAt += recovery
      streakLeft = randomInteger(random, tuning.streakMin, tuning.streakMax)
    }
  }

  let gateAt = randomBetween(random, tuning.gateMin * 0.55, tuning.gateMax)
  while (gateAt <= duration) {
    addAction('gate', gateAt)
    gateAt += randomBetween(random, tuning.gateMin, tuning.gateMax)
  }

  let hitAt = randomBetween(random, tuning.hitMin * 0.7, tuning.hitMax)
  while (hitAt <= duration) {
    addAction('hit', hitAt)
    hitAt += randomBetween(random, tuning.hitMin, tuning.hitMax)
  }

  let pulseAt = randomBetween(random, 2.2, 3.8)
  while (pulseAt <= duration) {
    const targets = randomInteger(random, 0, tuning.maxPulseTargets)
    addAction('pulse', pulseAt, targets)
    pulseAt += randomBetween(random, tuning.pulseMin, tuning.pulseMax)
  }

  return actions.sort((left, right) =>
    left.time - right.time || actionPriority[left.kind] - actionPriority[right.kind] || left.order - right.order,
  )
}

const makeTimeline = (actions: readonly BotAction[]): BotState[] => {
  const current = initialState()
  return actions.map((action) => {
    applyAction(current, action)
    return { ...current }
  })
}

const stateAt = (timeline: readonly BotState[], elapsedSeconds: number): BotState => {
  let low = 0
  let high = timeline.length - 1
  let found = -1

  while (low <= high) {
    const middle = (low + high) >>> 1
    if (timeline[middle].time <= elapsedSeconds) {
      found = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  const state = found >= 0 ? { ...timeline[found] } : initialState()
  expireCombo(state, elapsedSeconds)
  return state
}

const makeMovementProfile = (seed: number, speed: number): MovementProfile => {
  const random = seededRandom(mixSeed(seed, 0xa3c59ac3))
  return {
    phaseA: random() * Math.PI * 2,
    phaseB: random() * Math.PI * 2,
    phaseC: random() * Math.PI * 2,
    radiusBase: randomBetween(random, 16.5, 19.5),
    radiusSwing: randomBetween(random, 7.2, 10.2),
    weave: randomBetween(random, 2.4, 4.8),
    speed: speed * randomBetween(random, 0.94, 1.08),
    spin: randomBetween(random, 0.92, 1.38),
  }
}

const positionAt = (profile: MovementProfile, elapsedSeconds: number) => {
  const angle =
    profile.phaseA +
    elapsedSeconds * profile.speed +
    Math.sin(elapsedSeconds * 0.087 + profile.phaseB) * 0.7 +
    Math.sin(elapsedSeconds * 0.31 + profile.phaseC) * 0.16
  const radius =
    profile.radiusBase +
    Math.sin(elapsedSeconds * 0.145 + profile.phaseB) * profile.radiusSwing +
    Math.sin(elapsedSeconds * 0.47 + profile.phaseC) * 2.25
  let x = Math.cos(angle) * radius + Math.sin(elapsedSeconds * 0.19 + profile.phaseC) * profile.weave
  let z = Math.sin(angle) * radius + Math.cos(elapsedSeconds * 0.17 + profile.phaseB) * profile.weave
  const radial = Math.hypot(x, z)

  if (radial > MAX_BOT_RADIUS) {
    const scale = MAX_BOT_RADIUS / radial
    x *= scale
    z *= scale
  }

  return {
    x,
    y: 1.08 + Math.sin(elapsedSeconds * 5.6 + profile.phaseA) * 0.075,
    z,
  }
}

/**
 * A deterministic virtual opponent. Construct it once per match, then call sample
 * from the game loop; no wall-clock time or Math.random() is read internally.
 */
export class BotRivalSimulator {
  readonly difficulty: BotDifficulty
  readonly duration: number
  readonly name: string
  readonly color: CubeColor

  private readonly timeline: readonly BotState[]
  private readonly movement: MovementProfile
  private readonly tuning: DifficultyTuning
  private readonly startedAt: number

  constructor(options: BotRivalOptions) {
    const seed = normalizeSeed(options.seed)
    this.difficulty = options.difficulty ?? 'normal'
    this.tuning = DIFFICULTY_TUNING[this.difficulty]
    this.duration = Math.max(1, finiteOr(options.duration, RUN_DURATION))
    this.startedAt = finiteOr(options.startedAt, 0)

    const identityRandom = seededRandom(mixSeed(seed, 0x17eb2d5f))
    const suppliedName = options.name?.trim()
    this.name = suppliedName || BOT_NAMES[Math.floor(identityRandom() * BOT_NAMES.length)]
    this.color = options.color ?? CUBE_COLORS[Math.floor(identityRandom() * CUBE_COLORS.length)]
    this.timeline = makeTimeline(makeActions(seed, this.duration, this.tuning))
    this.movement = makeMovementProfile(seed, this.tuning.movementSpeed)
  }

  sample(input: BotRivalSampleInput): RivalSnapshot
  sample(elapsedSeconds: number, playerScore?: number, updatedAt?: number): RivalSnapshot
  sample(
    elapsedOrInput: number | BotRivalSampleInput,
    playerScore = 0,
    updatedAt?: number,
  ): RivalSnapshot {
    const input = typeof elapsedOrInput === 'number'
      ? { elapsedSeconds: elapsedOrInput, playerScore, updatedAt }
      : elapsedOrInput
    const elapsed = clamp(finiteOr(input.elapsedSeconds, 0), 0, this.duration)
    const observedPlayerScore = Math.max(0, finiteOr(input.playerScore, 0))
    const base = stateAt(this.timeline, elapsed)
    const score = base.score + this.pressureBonus(elapsed, base.score, base.peakScore, observedPlayerScore)
    const position = positionAt(this.movement, elapsed)

    return {
      name: this.name,
      color: this.color,
      score,
      combo: base.combo,
      charge: base.charge,
      shields: base.shields,
      position,
      rotationY:
        this.movement.phaseC +
        elapsed * this.movement.spin +
        Math.sin(elapsed * 1.9 + this.movement.phaseB) * 0.14,
      updatedAt: finiteOr(input.updatedAt, this.startedAt + Math.round(elapsed * 1_000)),
    }
  }

  /** Alias intended for frame-loop call sites. */
  update(elapsedSeconds: number, playerScore = 0, updatedAt?: number): RivalSnapshot {
    return this.sample(elapsedSeconds, playerScore, updatedAt)
  }

  private pressureBonus(elapsed: number, botScore: number, peakBotScore: number, playerScore: number): number {
    if (elapsed <= this.tuning.reactionDelay || playerScore <= 0 || botScore <= 0) return 0

    // Estimate telemetry from a few seconds ago instead of reading the player's
    // current total directly. The cap keeps seeded skill, not rubber-banding, as
    // the deciding factor in almost every match.
    const observedAt = elapsed - this.tuning.reactionDelay
    const delayedPlayerScore = playerScore * (observedAt / elapsed)
    const meaningfulLead = delayedPlayerScore - botScore - (700 + botScore * 0.025)
    if (meaningfulLead <= 0) return 0

    const rawBonus = Math.min(peakBotScore * this.tuning.pressureCap, meaningfulLead * this.tuning.pressureResponse)
    return Math.floor(rawBonus / 25) * 25
  }
}

export const createBotRival = (options: BotRivalOptions) => new BotRivalSimulator(options)

/** Pure convenience helper for one-off previews and tests. */
export const simulateBotRival = (
  options: BotRivalOptions,
  elapsedSeconds: number,
  playerScore = 0,
  updatedAt?: number,
): RivalSnapshot => new BotRivalSimulator(options).sample(elapsedSeconds, playerScore, updatedAt)
