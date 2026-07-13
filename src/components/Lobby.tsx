import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  Check,
  Copy,
  Crown,
  LoaderCircle,
  LogOut,
  Play,
  Radio,
  Shield,
  Swords,
  UserRound,
  Wifi,
} from 'lucide-react'
import { CUBE_COLORS } from '../game/constants'
import type { CubeColor, RivalSnapshot } from '../game/types'

export interface LobbyProps {
  playerName: string
  playerColor: CubeColor
  roomCode: string
  networkStatus: string
  rival: RivalSnapshot | null
  isHost: boolean
  canStart?: boolean
  notice?: string
  onCopyRoomCode: (roomCode: string) => void | Promise<void>
  onStartMatch: () => void
  onLeaveLobby: () => void
}

const pilotStyle = (color: CubeColor) =>
  ({
    '--pilot-color': CUBE_COLORS[color].primary,
    '--pilot-secondary': CUBE_COLORS[color].secondary,
  }) as CSSProperties

export function Lobby({
  playerName,
  playerColor,
  roomCode,
  networkStatus,
  rival,
  isHost,
  canStart = Boolean(rival),
  notice = '',
  onCopyRoomCode,
  onStartMatch,
  onLeaveLobby,
}: LobbyProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const resetTimer = useRef<number | undefined>(undefined)
  const displayedCode = roomCode || '------'

  useEffect(() => () => window.clearTimeout(resetTimer.current), [])

  const copyCode = async () => {
    if (!roomCode) return
    window.clearTimeout(resetTimer.current)
    try {
      await onCopyRoomCode(roomCode)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
    resetTimer.current = window.setTimeout(() => setCopyState('idle'), 1800)
  }

  return (
    <section className="screen-overlay lobby-screen" aria-labelledby="lobby-title">
      <div className="lobby-screen__scanline" aria-hidden="true" />
      <div className="lobby-panel glass-panel">
        <header className="lobby-header">
          <div>
            <span className="lobby-header__eyebrow">
              <Radio aria-hidden="true" size={15} /> Peer arena
            </span>
            <h1 id="lobby-title">Duel uplink</h1>
            <p>Share the code. Sync a rival. Own the grid.</p>
          </div>
          <div className="network-chip" role="status">
            <span className="network-chip__dot" aria-hidden="true" />
            <Wifi aria-hidden="true" size={16} />
            {networkStatus}
          </div>
        </header>

        <section className="room-code-card" aria-labelledby="room-code-heading">
          <div>
            <span id="room-code-heading" className="room-code-card__label">
              Secure arena code
            </span>
            <strong className="room-code-card__code" aria-label={`Arena code ${displayedCode.split('').join(' ')}`}>
              {displayedCode.split('').map((character, index) => (
                <span key={`${character}-${index}`}>{character}</span>
              ))}
            </strong>
          </div>
          <button className="button button--copy" type="button" onClick={() => void copyCode()} disabled={!roomCode}>
            {copyState === 'copied' ? <Check aria-hidden="true" size={18} /> : <Copy aria-hidden="true" size={18} />}
            {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy code'}
          </button>
        </section>

        <div className="versus-grid">
          <article className="pilot-card pilot-card--local" style={pilotStyle(playerColor)}>
            <div className="pilot-card__topline">
              <span className="pilot-card__role">
                {isHost ? <Crown aria-hidden="true" size={15} /> : <UserRound aria-hidden="true" size={15} />}
                {isHost ? 'Arena host' : 'Challenger'}
              </span>
              <span className="pilot-card__ready">
                <Check aria-hidden="true" size={14} /> Ready
              </span>
            </div>
            <div className="pilot-card__cube" aria-hidden="true">
              <span />
            </div>
            <div className="pilot-card__identity">
              <strong>{playerName}</strong>
              <span>{CUBE_COLORS[playerColor].label}</span>
            </div>
          </article>

          <div className="versus-badge" aria-label="versus">
            <Swords aria-hidden="true" size={22} />
            <span>VS</span>
          </div>

          {rival ? (
            <article className="pilot-card pilot-card--rival" style={pilotStyle(rival.color)}>
              <div className="pilot-card__topline">
                <span className="pilot-card__role">
                  <UserRound aria-hidden="true" size={15} /> Rival signal
                </span>
                <span className="pilot-card__ready">
                  <Check aria-hidden="true" size={14} /> Synced
                </span>
              </div>
              <div className="pilot-card__cube" aria-hidden="true">
                <span />
              </div>
              <div className="pilot-card__identity">
                <strong>{rival.name}</strong>
                <span>{CUBE_COLORS[rival.color].label}</span>
              </div>
            </article>
          ) : (
            <article className="pilot-card pilot-card--waiting" aria-live="polite">
              <div className="pilot-card__topline">
                <span className="pilot-card__role">
                  <Shield aria-hidden="true" size={15} /> Open slot
                </span>
              </div>
              <div className="pilot-card__waiting-icon" aria-hidden="true">
                <LoaderCircle size={32} />
              </div>
              <div className="pilot-card__identity">
                <strong>Awaiting rival</strong>
                <span>Keep this arena open</span>
              </div>
            </article>
          )}
        </div>

        {notice ? (
          <p className="lobby-notice" role="status">
            {notice}
          </p>
        ) : null}

        <footer className="lobby-actions">
          <button className="button button--ghost" type="button" onClick={onLeaveLobby}>
            <LogOut aria-hidden="true" size={18} /> Leave arena
          </button>
          {isHost ? (
            <button className="button button--primary button--launch" type="button" disabled={!canStart} onClick={onStartMatch}>
              <Play aria-hidden="true" size={19} fill="currentColor" />
              {canStart ? 'Launch duel' : 'Waiting for rival'}
            </button>
          ) : (
            <span className="host-waiting-message">
              <LoaderCircle aria-hidden="true" size={17} /> Host controls launch
            </span>
          )}
        </footer>
      </div>
    </section>
  )
}
