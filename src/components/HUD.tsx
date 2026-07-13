import {
  CircleHelp,
  Clock3,
  Pause,
  Play,
  Radio,
  Shield,
  Target,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react'
import { MAX_CHARGE, MAX_SHIELDS } from '../game/constants'
import type { GameMode, RivalSnapshot } from '../game/types'

export interface HUDProps {
  mode: GameMode
  score: number
  combo: number
  multiplier: number
  comboTime: number
  charge: number
  shields: number
  timeLeft: number
  wave: number
  objective: string
  objectiveProgress: number
  objectiveTarget: number
  rival: RivalSnapshot | null
  soundEnabled: boolean
  paused?: boolean
  notice?: string
  onPauseToggle: () => void
  onToggleSound: () => void
  onOpenHelp: () => void
}

const scoreFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const clampPercent = (value: number) => Math.min(100, Math.max(0, value))

const formatTime = (seconds: number) => {
  const wholeSeconds = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(wholeSeconds / 60)
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, '0')}`
}

export function HUD({
  mode,
  score,
  combo,
  multiplier,
  comboTime,
  charge,
  shields,
  timeLeft,
  wave,
  objective,
  objectiveProgress,
  objectiveTarget,
  rival,
  soundEnabled,
  paused = false,
  notice = '',
  onPauseToggle,
  onToggleSound,
  onOpenHelp,
}: HUDProps) {
  const objectivePercent = objectiveTarget > 0 ? clampPercent((objectiveProgress / objectiveTarget) * 100) : 0
  const chargePercent = clampPercent((charge / MAX_CHARGE) * 100)
  const comboPercent = clampPercent(comboTime <= 1 ? comboTime * 100 : comboTime)
  const isFinalSeconds = timeLeft <= 10

  return (
    <aside className="game-hud" aria-label="Arena status">
      <div className="hud-topbar">
        <section className="hud-score hud-module" aria-label={`Score ${scoreFormatter.format(score)}`}>
          <span className="hud-module__label">Signal score</span>
          <strong>{scoreFormatter.format(score).padStart(6, '0')}</strong>
          <span className="hud-score__wave">Wave {wave}</span>
        </section>

        <section className={`hud-timer hud-module${isFinalSeconds ? ' hud-timer--urgent' : ''}`} aria-label={`${formatTime(timeLeft)} remaining`}>
          <Clock3 aria-hidden="true" size={17} />
          <span>
            <small>Run time</small>
            <strong>{formatTime(timeLeft)}</strong>
          </span>
        </section>

        <nav className="hud-controls hud-module" aria-label="Game controls">
          <button className="hud-icon-button" type="button" onClick={onToggleSound} aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}>
            {soundEnabled ? <Volume2 aria-hidden="true" size={18} /> : <VolumeX aria-hidden="true" size={18} />}
          </button>
          <button className="hud-icon-button" type="button" onClick={onOpenHelp} aria-label="Open controls">
            <CircleHelp aria-hidden="true" size={18} />
          </button>
          <button className="hud-icon-button" type="button" onClick={onPauseToggle} aria-label={paused ? 'Resume game' : 'Pause game'}>
            {paused ? <Play aria-hidden="true" size={18} fill="currentColor" /> : <Pause aria-hidden="true" size={18} fill="currentColor" />}
          </button>
        </nav>
      </div>

      <section className={`combo-readout${combo > 1 ? ' combo-readout--active' : ''}`} aria-live="polite">
        <span className="combo-readout__count">{combo}</span>
        <div className="combo-readout__copy">
          <span>Chain</span>
          <strong>×{multiplier.toFixed(multiplier % 1 === 0 ? 0 : 1)}</strong>
        </div>
        <div className="combo-readout__timer" aria-hidden="true">
          <span style={{ width: `${comboPercent}%` }} />
        </div>
      </section>

      {mode === 'duel' ? (
        <section className={`rival-readout hud-module${rival ? '' : ' rival-readout--offline'}`} aria-label="Rival status">
          <div className="rival-readout__heading">
            <span>
              <Radio aria-hidden="true" size={14} /> Rival link
            </span>
            <strong>{rival?.name ?? 'SYNCING'}</strong>
          </div>
          <div className="rival-readout__stats">
            <span>
              <small>Score</small>
              <strong>{scoreFormatter.format(rival?.score ?? 0)}</strong>
            </span>
            <span>
              <small>Chain</small>
              <strong>{rival?.combo ?? 0}</strong>
            </span>
          </div>
          <div className="rival-readout__charge" aria-hidden="true">
            <span style={{ width: `${clampPercent(rival?.charge ?? 0)}%` }} />
          </div>
        </section>
      ) : null}

      <section className="objective-card hud-module" aria-label="Current objective">
        <div className="objective-card__heading">
          <span>
            <Target aria-hidden="true" size={16} /> Active objective
          </span>
          <strong>
            {objectiveProgress}/{objectiveTarget}
          </strong>
        </div>
        <p>{objective}</p>
        <div
          className="meter meter--objective"
          role="progressbar"
          aria-label={objective}
          aria-valuemin={0}
          aria-valuemax={objectiveTarget}
          aria-valuenow={Math.min(objectiveProgress, objectiveTarget)}
        >
          <span style={{ width: `${objectivePercent}%` }} />
        </div>
      </section>

      <section className="core-status" aria-label="Cube core status">
        <div className="shield-status" aria-label={`${shields} of ${MAX_SHIELDS} shields`}>
          {Array.from({ length: MAX_SHIELDS }, (_, index) => (
            <Shield
              key={index}
              className={index < shields ? 'shield-status__icon shield-status__icon--active' : 'shield-status__icon'}
              aria-hidden="true"
              size={21}
              fill={index < shields ? 'currentColor' : 'none'}
            />
          ))}
        </div>
        <div className="charge-status">
          <div className="charge-status__label">
            <span>
              <Zap aria-hidden="true" size={15} fill="currentColor" /> Pulse charge
            </span>
            <strong>{Math.round(charge)}%</strong>
          </div>
          <div
            className="meter meter--charge"
            role="progressbar"
            aria-label="Pulse charge"
            aria-valuemin={0}
            aria-valuemax={MAX_CHARGE}
            aria-valuenow={Math.round(Math.min(charge, MAX_CHARGE))}
          >
            <span style={{ width: `${chargePercent}%` }} />
          </div>
        </div>
      </section>

      {notice ? (
        <div className="hud-notice" role="status">
          {notice}
        </div>
      ) : null}

      {paused ? (
        <div className="pause-banner" role="status">
          <span>Simulation suspended</span>
          <strong>PAUSED</strong>
        </div>
      ) : null}
    </aside>
  )
}
