import type Peer from 'peerjs'
import type { DataConnection } from 'peerjs'
import type { CubeColor, RivalSnapshot, RunSummary } from './types'

export const DUEL_PROTOCOL_VERSION = 2
export const ROOM_CODE_LENGTH = 6

const ROOM_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const ROOM_PATTERN = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/
const PEER_ID_PREFIX = 'electrocube-v2-'
const OPEN_TIMEOUT_MS = 12_000
const CONNECTION_TIMEOUT_MS = 15_000
const HEARTBEAT_INTERVAL_MS = 5_000
const CONNECTION_STALE_MS = 22_000

export type DuelRole = 'host' | 'guest'
export type DuelConnectionState =
  | 'idle'
  | 'opening'
  | 'hosting'
  | 'joining'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'closed'

export interface DuelPlayer {
  name: string
  color: CubeColor
}

export type DuelEmote = 'gg' | 'charged' | 'close-one' | 'rematch'

export type DuelMessage =
  | { type: 'hello'; player: DuelPlayer }
  | { type: 'ready'; ready: boolean }
  | { type: 'start'; seed: number; startsAt: number; duration: number }
  | { type: 'snapshot'; snapshot: RivalSnapshot }
  | { type: 'finish'; summary: RunSummary }
  | { type: 'jam'; firedAt: number }
  | { type: 'rematch'; accepted: boolean }
  | { type: 'emote'; emote: DuelEmote }
  | { type: 'leave'; reason?: string }
  | { type: 'ping'; nonce: string }
  | { type: 'pong'; nonce: string }
  | { type: 'reject'; reason: 'room-full' | 'version-mismatch' }

interface DuelEnvelope {
  protocol: typeof DUEL_PROTOCOL_VERSION
  id: string
  sentAt: number
  payload: DuelMessage
}

export interface DuelMessageMeta {
  id: string
  sentAt: number
  receivedAt: number
  remotePeerId: string
}

export interface DuelSessionInfo {
  role: DuelRole
  roomCode: string
  remotePeerId: string
}

export interface DuelSessionSnapshot {
  state: DuelConnectionState
  role: DuelRole | null
  roomCode: string
  remotePeerId: string | null
  latencyMs: number | null
}

export interface DuelSessionCallbacks {
  onStateChange?: (state: DuelConnectionState, detail: string) => void
  onConnected?: (info: DuelSessionInfo) => void
  onMessage?: (message: DuelMessage, meta: DuelMessageMeta) => void
  onLatency?: (latencyMs: number) => void
  onDisconnected?: (reason: string) => void
  onError?: (error: DuelNetworkError) => void
}

export type DuelErrorCode =
  | 'unsupported'
  | 'invalid-room'
  | 'room-taken'
  | 'room-not-found'
  | 'network'
  | 'connection'
  | 'timeout'
  | 'cancelled'
  | 'unknown'

export class DuelNetworkError extends Error {
  readonly code: DuelErrorCode
  override readonly cause?: unknown

  constructor(code: DuelErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = 'DuelNetworkError'
    this.code = code
    this.cause = cause
  }
}

const CUBE_COLORS: readonly CubeColor[] = ['cyan', 'magenta', 'violet', 'lime', 'amber']
const EMOTES: readonly DuelEmote[] = ['gg', 'charged', 'close-one', 'rematch']

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isCubeColor = (value: unknown): value is CubeColor =>
  typeof value === 'string' && CUBE_COLORS.includes(value as CubeColor)

const isDuelPlayer = (value: unknown): value is DuelPlayer => {
  const player = asRecord(value)
  return player !== null && typeof player.name === 'string' && isCubeColor(player.color)
}

const isVectorSnapshot = (value: unknown) => {
  const vector = asRecord(value)
  return (
    vector !== null &&
    isFiniteNumber(vector.x) &&
    isFiniteNumber(vector.y) &&
    isFiniteNumber(vector.z)
  )
}

const isRivalSnapshot = (value: unknown): value is RivalSnapshot => {
  const snapshot = asRecord(value)
  return (
    snapshot !== null &&
    typeof snapshot.name === 'string' &&
    isCubeColor(snapshot.color) &&
    isFiniteNumber(snapshot.score) &&
    isFiniteNumber(snapshot.combo) &&
    isFiniteNumber(snapshot.charge) &&
    isFiniteNumber(snapshot.shields) &&
    isVectorSnapshot(snapshot.position) &&
    isFiniteNumber(snapshot.rotationY) &&
    isFiniteNumber(snapshot.updatedAt)
  )
}

const isRunSummary = (value: unknown): value is RunSummary => {
  const summary = asRecord(value)
  return (
    summary !== null &&
    isFiniteNumber(summary.score) &&
    isFiniteNumber(summary.bestCombo) &&
    isFiniteNumber(summary.shards) &&
    isFiniteNumber(summary.drones) &&
    isFiniteNumber(summary.banks) &&
    isFiniteNumber(summary.duration) &&
    (summary.won === undefined || typeof summary.won === 'boolean')
  )
}

const isDuelMessage = (value: unknown): value is DuelMessage => {
  const message = asRecord(value)
  if (!message || typeof message.type !== 'string') return false

  switch (message.type) {
    case 'hello':
      return isDuelPlayer(message.player)
    case 'ready':
      return typeof message.ready === 'boolean'
    case 'start':
      return (
        isFiniteNumber(message.seed) &&
        isFiniteNumber(message.startsAt) &&
        isFiniteNumber(message.duration)
      )
    case 'snapshot':
      return isRivalSnapshot(message.snapshot)
    case 'finish':
      return isRunSummary(message.summary)
    case 'jam':
      return isFiniteNumber(message.firedAt)
    case 'rematch':
      return typeof message.accepted === 'boolean'
    case 'emote':
      return typeof message.emote === 'string' && EMOTES.includes(message.emote as DuelEmote)
    case 'leave':
      return message.reason === undefined || typeof message.reason === 'string'
    case 'ping':
    case 'pong':
      return typeof message.nonce === 'string'
    case 'reject':
      return message.reason === 'room-full' || message.reason === 'version-mismatch'
    default:
      return false
  }
}

const isDuelEnvelope = (value: unknown): value is DuelEnvelope => {
  const envelope = asRecord(value)
  return (
    envelope !== null &&
    envelope.protocol === DUEL_PROTOCOL_VERSION &&
    typeof envelope.id === 'string' &&
    isFiniteNumber(envelope.sentAt) &&
    isDuelMessage(envelope.payload)
  )
}

const createMessageId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const createEnvelope = (payload: DuelMessage): DuelEnvelope => ({
  protocol: DUEL_PROTOCOL_VERSION,
  id: createMessageId(),
  sentAt: Date.now(),
  payload,
})

const getPeerErrorType = (cause: unknown) => {
  const error = asRecord(cause)
  return typeof error?.type === 'string' ? error.type : ''
}

const getErrorMessage = (cause: unknown) => {
  if (cause instanceof Error) return cause.message
  const error = asRecord(cause)
  return typeof error?.message === 'string' ? error.message : 'Unknown network error'
}

const mapPeerError = (cause: unknown): DuelNetworkError => {
  const type = getPeerErrorType(cause)

  switch (type) {
    case 'unavailable-id':
      return new DuelNetworkError('room-taken', 'That room code is already active.', cause)
    case 'peer-unavailable':
      return new DuelNetworkError('room-not-found', 'No active duel was found for that room code.', cause)
    case 'browser-incompatible':
      return new DuelNetworkError('unsupported', 'This browser does not support peer-to-peer duels.', cause)
    case 'invalid-id':
      return new DuelNetworkError('invalid-room', 'The room code is invalid.', cause)
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return new DuelNetworkError('network', 'The matchmaking network is unavailable.', cause)
    case 'webrtc':
      return new DuelNetworkError('connection', 'The direct duel connection could not be established.', cause)
    default:
      return new DuelNetworkError('unknown', getErrorMessage(cause), cause)
  }
}

export const normalizeRoomCode = (value: string): string => {
  const roomCode = value.toUpperCase().replace(/[\s-]/g, '')
  if (!ROOM_PATTERN.test(roomCode)) {
    throw new DuelNetworkError(
      'invalid-room',
      `Room codes contain ${ROOM_CODE_LENGTH} letters or numbers and omit 0, 1, I, L, and O.`,
    )
  }
  return roomCode
}

export const isValidRoomCode = (value: string) => {
  try {
    normalizeRoomCode(value)
    return true
  } catch {
    return false
  }
}

export const generateRoomCode = (): string => {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  return Array.from(bytes, (byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join('')
}

export const formatRoomCode = (value: string) => {
  const roomCode = normalizeRoomCode(value)
  return `${roomCode.slice(0, 3)}-${roomCode.slice(3)}`
}

const roomCodeToPeerId = (roomCode: string) => `${PEER_ID_PREFIX}${roomCode.toLowerCase()}`

const loadPeerConstructor = async () => (await import('peerjs')).default

/**
 * A single-opponent PeerJS session. Hosting reserves a human-friendly code;
 * joining connects directly to it through PeerJS's public signaling service.
 */
export class DuelSession {
  private identity: DuelPlayer
  private callbacks: DuelSessionCallbacks
  private peer: Peer | null = null
  private connection: DataConnection | null = null
  private connectionState: DuelConnectionState = 'idle'
  private currentRole: DuelRole | null = null
  private currentRoomCode = ''
  private operation = 0
  private disposed = false
  private heartbeatTimer: number | null = null
  private lastReceivedAt = 0
  private currentLatency: number | null = null
  private readonly pendingPings = new Map<string, number>()

  constructor(identity: DuelPlayer, callbacks: DuelSessionCallbacks = {}) {
    this.identity = { ...identity }
    this.callbacks = callbacks
  }

  get snapshot(): DuelSessionSnapshot {
    return {
      state: this.connectionState,
      role: this.currentRole,
      roomCode: this.currentRoomCode,
      remotePeerId: this.connection?.peer ?? null,
      latencyMs: this.currentLatency,
    }
  }

  setCallbacks(callbacks: DuelSessionCallbacks) {
    this.callbacks = callbacks
  }

  updateIdentity(identity: DuelPlayer) {
    this.identity = { ...identity }
    if (this.connectionState === 'connected') this.send({ type: 'hello', player: this.identity })
  }

  async host(requestedCode = generateRoomCode()): Promise<string> {
    this.assertSupported()
    const roomCode = normalizeRoomCode(requestedCode)
    const operation = this.beginOperation('host', roomCode)
    this.emitState('opening', 'RESERVING ROOM')

    let peer: Peer
    try {
      const PeerConstructor = await loadPeerConstructor()
      if (!this.isCurrent(operation)) throw new DuelNetworkError('cancelled', 'Hosting was cancelled.')
      peer = new PeerConstructor(roomCodeToPeerId(roomCode), { debug: 0 })
    } catch (cause) {
      const error = cause instanceof DuelNetworkError ? cause : mapPeerError(cause)
      this.failOperation(operation, error)
      throw error
    }

    this.peer = peer
    this.attachPeerEvents(peer, operation)
    peer.on('connection', (connection) => this.acceptIncomingConnection(connection, operation))

    try {
      await this.waitForPeerOpen(peer, operation)
      if (!this.isCurrent(operation)) throw new DuelNetworkError('cancelled', 'Hosting was cancelled.')
      this.emitState('hosting', 'ROOM ONLINE')
      return roomCode
    } catch (cause) {
      const error = cause instanceof DuelNetworkError ? cause : mapPeerError(cause)
      this.failOperation(operation, error)
      throw error
    }
  }

  async join(requestedCode: string): Promise<string> {
    this.assertSupported()
    const roomCode = normalizeRoomCode(requestedCode)
    const operation = this.beginOperation('guest', roomCode)
    this.emitState('joining', 'FINDING ROOM')

    let peer: Peer
    try {
      const PeerConstructor = await loadPeerConstructor()
      if (!this.isCurrent(operation)) throw new DuelNetworkError('cancelled', 'Joining was cancelled.')
      peer = new PeerConstructor()
    } catch (cause) {
      const error = cause instanceof DuelNetworkError ? cause : mapPeerError(cause)
      this.failOperation(operation, error)
      throw error
    }

    this.peer = peer
    this.attachPeerEvents(peer, operation)

    try {
      await this.waitForPeerOpen(peer, operation)
      if (!this.isCurrent(operation)) throw new DuelNetworkError('cancelled', 'Joining was cancelled.')

      this.emitState('connecting', 'OPENING DIRECT LINK')
      const connection = peer.connect(roomCodeToPeerId(roomCode), {
        reliable: true,
        metadata: { protocol: DUEL_PROTOCOL_VERSION },
      })
      await this.bindConnection(connection, operation)
      return roomCode
    } catch (cause) {
      const error = cause instanceof DuelNetworkError ? cause : mapPeerError(cause)
      this.failOperation(operation, error)
      throw error
    }
  }

  send(message: DuelMessage): boolean {
    const connection = this.connection
    if (!connection?.open) return false

    try {
      connection.send(createEnvelope(message))
      return true
    } catch (cause) {
      this.emitError(new DuelNetworkError('connection', 'A duel update could not be sent.', cause))
      return false
    }
  }

  close(reason = 'Left the duel') {
    if (this.connection?.open) this.send({ type: 'leave', reason })

    this.operation += 1
    this.cleanupTransport()
    this.currentRole = null
    this.currentRoomCode = ''
    this.emitState('closed', 'OFFLINE')
    this.callbacks.onDisconnected?.(reason)
  }

  dispose() {
    if (this.disposed) return
    this.close('Session closed')
    this.disposed = true
    this.callbacks = {}
  }

  private assertSupported() {
    if (this.disposed) throw new DuelNetworkError('cancelled', 'This duel session has been disposed.')
    if (typeof window === 'undefined' || typeof window.RTCPeerConnection === 'undefined') {
      throw new DuelNetworkError('unsupported', 'This browser does not support peer-to-peer duels.')
    }
  }

  private beginOperation(role: DuelRole, roomCode: string) {
    this.operation += 1
    this.cleanupTransport()
    this.currentRole = role
    this.currentRoomCode = roomCode
    this.currentLatency = null
    return this.operation
  }

  private isCurrent(operation: number) {
    return !this.disposed && operation === this.operation
  }

  private attachPeerEvents(peer: Peer, operation: number) {
    peer.on('error', (cause) => {
      if (!this.isCurrent(operation)) return
      const error = mapPeerError(cause)
      this.emitError(error)
      if (this.connectionState !== 'connected') this.emitState('error', error.message)
    })

    peer.on('disconnected', () => {
      if (!this.isCurrent(operation)) return

      if (this.connection?.open) {
        // Existing WebRTC data links remain usable if signaling briefly drops.
        return
      }

      this.emitState('disconnected', 'MATCHMAKING LINK LOST')
      this.callbacks.onDisconnected?.('The matchmaking link was interrupted.')
    })

    peer.on('close', () => {
      if (!this.isCurrent(operation) || this.connection?.open) return
      this.emitState('disconnected', 'NETWORK CLOSED')
    })
  }

  private waitForPeerOpen(peer: Peer, operation: number): Promise<string> {
    return new Promise((resolve, reject) => {
      let settled = false
      const rejectOnce = (error: DuelNetworkError) => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        reject(error)
      }
      const timeout = window.setTimeout(() => {
        rejectOnce(
          this.isCurrent(operation)
            ? new DuelNetworkError('timeout', 'Matchmaking took too long to respond.')
            : new DuelNetworkError('cancelled', 'Matchmaking was cancelled.'),
        )
      }, OPEN_TIMEOUT_MS)

      peer.once('open', (id) => {
        if (!this.isCurrent(operation)) {
          rejectOnce(new DuelNetworkError('cancelled', 'Matchmaking was cancelled.'))
          return
        }
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        resolve(id)
      })

      peer.once('error', (cause) => {
        rejectOnce(
          this.isCurrent(operation)
            ? mapPeerError(cause)
            : new DuelNetworkError('cancelled', 'Matchmaking was cancelled.'),
        )
      })

      peer.once('close', () => {
        rejectOnce(
          this.isCurrent(operation)
            ? new DuelNetworkError('network', 'The matchmaking connection closed before the room opened.')
            : new DuelNetworkError('cancelled', 'Matchmaking was cancelled.'),
        )
      })
    })
  }

  private acceptIncomingConnection(connection: DataConnection, operation: number) {
    if (!this.isCurrent(operation)) {
      connection.close()
      return
    }

    const metadata = asRecord(connection.metadata)
    if (metadata?.protocol !== DUEL_PROTOCOL_VERSION) {
      this.rejectConnection(connection, 'version-mismatch')
      return
    }

    if (this.connection !== null) {
      this.rejectConnection(connection, 'room-full')
      return
    }

    this.emitState('connecting', 'RIVAL DETECTED')
    void this.bindConnection(connection, operation).catch(() => undefined)
  }

  private rejectConnection(connection: DataConnection, reason: 'room-full' | 'version-mismatch') {
    const reject = () => {
      try {
        connection.send(createEnvelope({ type: 'reject', reason }))
      } finally {
        window.setTimeout(() => connection.close(), 120)
      }
    }

    if (connection.open) reject()
    else connection.once('open', reject)
  }

  private bindConnection(connection: DataConnection, operation: number): Promise<void> {
    this.connection = connection

    return new Promise((resolve, reject) => {
      let opened = false
      let settled = false
      const timeout = window.setTimeout(() => {
        if (settled) return
        if (this.isCurrent(operation)) connection.close()
        rejectBeforeOpen(
          this.isCurrent(operation)
            ? new DuelNetworkError('timeout', 'The rival did not complete the direct connection.')
            : new DuelNetworkError('cancelled', 'The duel connection was cancelled.'),
        )
      }, CONNECTION_TIMEOUT_MS)

      const rejectBeforeOpen = (error: DuelNetworkError) => {
        if (opened || settled) return
        settled = true
        window.clearTimeout(timeout)
        reject(error)
      }

      this.peer?.on('error', (cause) => rejectBeforeOpen(mapPeerError(cause)))

      connection.on('open', () => {
        if (!this.isCurrent(operation)) {
          connection.close()
          rejectBeforeOpen(new DuelNetworkError('cancelled', 'The duel connection was cancelled.'))
          return
        }

        opened = true
        settled = true
        window.clearTimeout(timeout)
        this.lastReceivedAt = Date.now()
        this.emitState('connected', 'DIRECT LINK STABLE')
        this.send({ type: 'hello', player: this.identity })
        this.startHeartbeat(operation)

        if (this.currentRole) {
          this.callbacks.onConnected?.({
            role: this.currentRole,
            roomCode: this.currentRoomCode,
            remotePeerId: connection.peer,
          })
        }
        resolve()
      })

      connection.on('data', (data: unknown) => {
        if (!this.isCurrent(operation) || !isDuelEnvelope(data)) return
        this.handleEnvelope(data, connection)
      })

      connection.on('error', (cause) => {
        if (!this.isCurrent(operation)) {
          rejectBeforeOpen(new DuelNetworkError('cancelled', 'The duel connection was cancelled.'))
          return
        }
        const error = new DuelNetworkError('connection', getErrorMessage(cause), cause)
        this.emitError(error)
        rejectBeforeOpen(error)
      })

      connection.on('close', () => {
        if (!this.isCurrent(operation)) {
          rejectBeforeOpen(new DuelNetworkError('cancelled', 'The duel connection was cancelled.'))
          return
        }
        window.clearTimeout(timeout)
        this.stopHeartbeat()
        if (this.connection === connection) this.connection = null

        if (!opened) {
          rejectBeforeOpen(new DuelNetworkError('connection', 'The rival closed the connection.'))
          return
        }

        this.emitState('disconnected', 'RIVAL DISCONNECTED')
        this.callbacks.onDisconnected?.('The rival left the duel.')
      })
    })
  }

  private handleEnvelope(envelope: DuelEnvelope, connection: DataConnection) {
    const receivedAt = Date.now()
    this.lastReceivedAt = receivedAt

    if (envelope.payload.type === 'ping') {
      this.send({ type: 'pong', nonce: envelope.payload.nonce })
    } else if (envelope.payload.type === 'pong') {
      const sentAt = this.pendingPings.get(envelope.payload.nonce)
      if (sentAt !== undefined) {
        this.pendingPings.delete(envelope.payload.nonce)
        this.currentLatency = Math.max(0, receivedAt - sentAt)
        this.callbacks.onLatency?.(this.currentLatency)
      }
    } else if (envelope.payload.type === 'reject') {
      const message =
        envelope.payload.reason === 'room-full'
          ? 'That duel already has two players.'
          : 'The rival is running an incompatible game version.'
      this.emitError(new DuelNetworkError('connection', message))
    }

    this.callbacks.onMessage?.(envelope.payload, {
      id: envelope.id,
      sentAt: envelope.sentAt,
      receivedAt,
      remotePeerId: connection.peer,
    })
  }

  private startHeartbeat(operation: number) {
    this.stopHeartbeat()
    this.heartbeatTimer = window.setInterval(() => {
      if (!this.isCurrent(operation) || !this.connection?.open) return

      if (Date.now() - this.lastReceivedAt > CONNECTION_STALE_MS) {
        this.emitError(new DuelNetworkError('connection', 'The rival stopped responding.'))
        this.connection.close()
        return
      }

      const nonce = createMessageId()
      this.pendingPings.set(nonce, Date.now())
      this.send({ type: 'ping', nonce })

      for (const [pendingNonce, sentAt] of this.pendingPings) {
        if (Date.now() - sentAt > CONNECTION_STALE_MS) this.pendingPings.delete(pendingNonce)
      }
    }, HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.heartbeatTimer)
    }
    this.heartbeatTimer = null
    this.pendingPings.clear()
  }

  private cleanupTransport() {
    this.stopHeartbeat()
    const connection = this.connection
    const peer = this.peer
    this.connection = null
    this.peer = null

    try {
      connection?.close()
    } catch {
      // PeerJS may already be closing the underlying data channel.
    }

    try {
      peer?.destroy()
    } catch {
      // Destroy is best-effort during navigation and browser teardown.
    }
  }

  private failOperation(operation: number, error: DuelNetworkError) {
    if (!this.isCurrent(operation)) return
    const alreadyReported = this.connectionState === 'error'
    this.operation += 1
    this.cleanupTransport()
    this.emitState('error', error.message)
    if (!alreadyReported) this.emitError(error)
  }

  private emitState(state: DuelConnectionState, detail: string) {
    this.connectionState = state
    this.callbacks.onStateChange?.(state, detail)
  }

  private emitError(error: DuelNetworkError) {
    this.callbacks.onError?.(error)
  }
}

export const createDuelSession = (identity: DuelPlayer, callbacks: DuelSessionCallbacks = {}) =>
  new DuelSession(identity, callbacks)
