import { useId, useState, type CSSProperties, type FormEvent } from 'react'
import {
  Bolt,
  ChevronRight,
  CircleHelp,
  Gamepad2,
  Radio,
  Sparkles,
  Trophy,
  UserRound,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { CUBE_COLORS } from '../game/constants'
import type { CubeColor } from '../game/types'

export interface MainMenuProps {
  playerName: string
  playerColor: CubeColor
  soundEnabled: boolean
  reducedEffects: boolean
  notice?: string
  onNameChange: (name: string) => void
  onColorChange: (color: CubeColor) => void
  onPlaySolo: () => void
  onCreateRoom: () => void
  onJoinRoom: (roomCode: string) => void
  onToggleSound: () => void
  onToggleReducedEffects: () => void
  onOpenHelp: () => void
}

const ROOM_CODE_LENGTH = 6

const cleanPlayerName = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9_\- ]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 14)

const cleanRoomCode = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^23456789ABCDEFGHJKMNPQRSTUVWXYZ]/g, '')
    .slice(0, ROOM_CODE_LENGTH)

const colorStyle = (color: CubeColor) =>
  ({
    '--cube-color': CUBE_COLORS[color].primary,
    '--cube-color-secondary': CUBE_COLORS[color].secondary,
  }) as CSSProperties

export function MainMenu({
  playerName,
  playerColor,
  soundEnabled,
  reducedEffects,
  notice = '',
  onNameChange,
  onColorChange,
  onPlaySolo,
  onCreateRoom,
  onJoinRoom,
  onToggleSound,
  onToggleReducedEffects,
  onOpenHelp,
}: MainMenuProps) {
  const nameInputId = useId()
  const roomInputId = useId()
  const [nameDraft, setNameDraft] = useState(playerName)
  const [roomCode, setRoomCode] = useState('')
  const [joinAttempted, setJoinAttempted] = useState(false)

  const commitName = () => {
    const nextName = cleanPlayerName(nameDraft) || 'ROOKIE'
    setNameDraft(nextName)
    onNameChange(nextName)
  }

  const handleJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setJoinAttempted(true)
    if (roomCode.length !== ROOM_CODE_LENGTH) return
    onJoinRoom(roomCode)
  }

  const roomCodeError = joinAttempted && roomCode.length !== ROOM_CODE_LENGTH

  return (
    <section className="screen-overlay main-menu" aria-labelledby="electrocube-title">
      <div className="main-menu__orb main-menu__orb--one" aria-hidden="true" />
      <div className="main-menu__orb main-menu__orb--two" aria-hidden="true" />

      <div className="main-menu__shell glass-panel">
        <header className="brand-lockup">
          <span className="brand-lockup__eyebrow">
            <Sparkles aria-hidden="true" size={15} /> Neon arena protocol
          </span>
          <h1 id="electrocube-title" className="brand-lockup__title">
            <span>ELECTRO</span>
            <span>CUBE</span>
          </h1>
          <p className="brand-lockup__tagline">Charge. Chain. Bank. Outrun the grid.</p>
        </header>

        <div className="main-menu__content">
          <section className="profile-card" aria-labelledby="profile-heading">
            <div className="panel-heading">
              <span className="panel-heading__icon" aria-hidden="true">
                <UserRound size={19} />
              </span>
              <div>
                <span className="panel-heading__kicker">Pilot profile</span>
                <h2 id="profile-heading">Choose your signal</h2>
              </div>
            </div>

            <label className="field-label" htmlFor={nameInputId}>
              Callsign
            </label>
            <div className="text-field text-field--profile">
              <span className="text-field__prefix" aria-hidden="true">
                //
              </span>
              <input
                id={nameInputId}
                value={nameDraft}
                maxLength={14}
                autoComplete="nickname"
                spellCheck={false}
                onChange={(event) => setNameDraft(cleanPlayerName(event.target.value))}
                onBlur={commitName}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
                aria-describedby={`${nameInputId}-hint`}
              />
              <span className="text-field__count" aria-hidden="true">
                {nameDraft.length}/14
              </span>
            </div>
            <span id={`${nameInputId}-hint`} className="sr-only">
              Up to 14 letters, numbers, spaces, underscores, or hyphens.
            </span>

            <fieldset className="color-picker">
              <legend>Core color</legend>
              <div className="color-picker__options">
                {(Object.keys(CUBE_COLORS) as CubeColor[]).map((color) => {
                  const config = CUBE_COLORS[color]
                  const selected = playerColor === color
                  return (
                    <button
                      key={color}
                      className={`color-swatch${selected ? ' color-swatch--selected' : ''}`}
                      type="button"
                      style={colorStyle(color)}
                      aria-label={config.label}
                      aria-pressed={selected}
                      title={config.label}
                      onClick={() => onColorChange(color)}
                    >
                      <span className="color-swatch__core" aria-hidden="true" />
                      <span className="color-swatch__label">{config.label}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>
          </section>

          <section className="play-card" aria-labelledby="play-heading">
            <div className="panel-heading panel-heading--compact">
              <span className="panel-heading__icon" aria-hidden="true">
                <Bolt size={19} />
              </span>
              <div>
                <span className="panel-heading__kicker">Enter the grid</span>
                <h2 id="play-heading">Select protocol</h2>
              </div>
            </div>

            <div className="mode-actions">
              <button className="mode-button mode-button--hero" type="button" onClick={onPlaySolo}>
                <span className="mode-button__icon" aria-hidden="true">
                  <Gamepad2 size={24} />
                </span>
                <span className="mode-button__copy">
                  <strong>Solo overdrive</strong>
                  <small>90-second score attack</small>
                </span>
                <ChevronRight className="mode-button__arrow" aria-hidden="true" size={21} />
              </button>

              <button className="mode-button" type="button" onClick={onCreateRoom}>
                <span className="mode-button__icon" aria-hidden="true">
                  <Radio size={23} />
                </span>
                <span className="mode-button__copy">
                  <strong>Create duel</strong>
                  <small>Open a private arena</small>
                </span>
                <ChevronRight className="mode-button__arrow" aria-hidden="true" size={21} />
              </button>
            </div>

            <div className="join-divider" aria-hidden="true">
              <span>or link to a rival</span>
            </div>

            <form className="join-form" onSubmit={handleJoin} noValidate>
              <label className="field-label" htmlFor={roomInputId}>
                Arena code
              </label>
              <div className={`join-form__row${roomCodeError ? ' join-form__row--invalid' : ''}`}>
                <input
                  id={roomInputId}
                  className="room-code-input"
                  value={roomCode}
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={ROOM_CODE_LENGTH}
                  placeholder="A7K9Q2"
                  aria-invalid={roomCodeError}
                  aria-describedby={`${roomInputId}-message`}
                  onChange={(event) => {
                    setRoomCode(cleanRoomCode(event.target.value))
                    setJoinAttempted(false)
                  }}
                />
                <button className="button button--join" type="submit" disabled={roomCode.length !== ROOM_CODE_LENGTH}>
                  <Users aria-hidden="true" size={18} /> Join
                </button>
              </div>
              <span
                id={`${roomInputId}-message`}
                className={`field-message${roomCodeError ? ' field-message--error' : ''}`}
                aria-live="polite"
              >
                {roomCodeError ? 'Enter the complete 6-character code.' : 'Codes are shared by the arena host.'}
              </span>
            </form>

            {notice ? (
              <p className="menu-notice" role="status">
                <span className="menu-notice__pulse" aria-hidden="true" />
                {notice}
              </p>
            ) : null}
          </section>
        </div>

        <footer className="main-menu__footer">
          <div className="quick-settings" aria-label="Game settings">
            <button className="icon-label-button" type="button" onClick={onToggleSound} aria-pressed={soundEnabled}>
              {soundEnabled ? <Volume2 aria-hidden="true" size={18} /> : <VolumeX aria-hidden="true" size={18} />}
              Sound {soundEnabled ? 'on' : 'off'}
            </button>
            <button
              className="icon-label-button"
              type="button"
              onClick={onToggleReducedEffects}
              aria-pressed={reducedEffects}
            >
              <Sparkles aria-hidden="true" size={18} />
              FX {reducedEffects ? 'reduced' : 'full'}
            </button>
            <button className="icon-label-button" type="button" onClick={onOpenHelp}>
              <CircleHelp aria-hidden="true" size={18} /> How to play
            </button>
          </div>
          <span className="main-menu__rank-tease">
            <Trophy aria-hidden="true" size={15} /> Legend ladder + your device bests
          </span>
        </footer>
      </div>
    </section>
  )
}
