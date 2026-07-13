import { useEffect } from 'react'
import { CircleHelp, Keyboard, Move, Shield, Sparkles, Target, X, Zap } from 'lucide-react'
import { KEY_BINDINGS } from '../game/constants'

export interface HelpPanelProps {
  open: boolean
  onClose: () => void
}

export function HelpPanel({ open, onClose }: HelpPanelProps) {
  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <div
      className="modal-backdrop help-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <section className="help-panel glass-panel" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <header className="help-panel__header">
          <span className="help-panel__icon" aria-hidden="true">
            <CircleHelp size={24} />
          </span>
          <div>
            <span>Grid manual</span>
            <h2 id="help-title">How to overdrive</h2>
          </div>
          <button className="icon-button help-panel__close" type="button" onClick={onClose} aria-label="Close help" autoFocus>
            <X aria-hidden="true" size={20} />
          </button>
        </header>

        <div className="help-panel__content">
          <section className="control-guide" aria-labelledby="controls-heading">
            <div className="help-section-heading">
              <Keyboard aria-hidden="true" size={18} />
              <h3 id="controls-heading">Controls</h3>
            </div>
            <dl className="control-list">
              <div>
                <dt>
                  <Move aria-hidden="true" size={17} /> Move
                </dt>
                <dd>
                  {KEY_BINDINGS.movement.map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                  <kbd>STICK</kbd>
                </dd>
              </div>
              <div>
                <dt>
                  <Sparkles aria-hidden="true" size={17} /> Phase dash
                </dt>
                <dd>
                  {KEY_BINDINGS.dash.map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                  <kbd>PAD A</kbd>
                </dd>
              </div>
              <div>
                <dt>
                  <Zap aria-hidden="true" size={17} /> Pulse blast
                </dt>
                <dd>
                  {KEY_BINDINGS.pulse.map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                  <kbd>PAD B/X</kbd>
                </dd>
              </div>
              <div>
                <dt>Pause</dt>
                <dd>
                  {KEY_BINDINGS.pause.map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                </dd>
              </div>
            </dl>
          </section>

          <section className="mission-guide" aria-labelledby="mission-heading">
            <div className="help-section-heading">
              <Target aria-hidden="true" size={18} />
              <h3 id="mission-heading">The loop</h3>
            </div>
            <ol className="mission-steps">
              <li>
                <span>01</span>
                <div>
                  <strong>Collect</strong>
                  <p>Follow the vertical beacon through the requested shard colors. Any shard still builds score.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Overdrive</strong>
                  <p>Dash through gates and pulse hostile drones before the chain expires.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Bank</strong>
                  <p>Hit the reactor with a charged core to lock in points and raise the wave.</p>
                </div>
              </li>
            </ol>
          </section>
        </div>

        <aside className="help-tip">
          <Shield aria-hidden="true" size={19} />
          <p>
            <strong>Pilot tip:</strong> Ringed rare shards can restore shields or instantly reset dash. A full pulse clears nearby threats.
          </p>
        </aside>

        <button className="button button--primary help-panel__ready" type="button" onClick={onClose}>
          Ready to ride
        </button>
      </section>
    </div>
  )
}
