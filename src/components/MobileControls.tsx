import { ChevronsUp, MoveDown, MoveLeft, MoveRight, Zap } from 'lucide-react'
import { resetVirtualControls, setVirtualControl, type VirtualControl } from '../game/input'

interface ControlButtonProps {
  control: VirtualControl
  label: string
  className?: string
  children: React.ReactNode
}

function ControlButton({ control, label, className = '', children }: ControlButtonProps) {
  const release = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setVirtualControl(control, false)
  }

  return (
    <button
      className={className}
      type="button"
      aria-label={label}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        setVirtualControl(control, true)
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      {children}
    </button>
  )
}

export function MobileControls({ visible }: { visible: boolean }) {
  if (!visible) {
    resetVirtualControls()
    return null
  }

  return (
    <div className="mobile-controls" aria-label="Touch game controls">
      <div className="mobile-dpad">
        <ControlButton control="up" label="Move forward" className="mobile-control mobile-control--up">
          <ChevronsUp aria-hidden="true" />
        </ControlButton>
        <ControlButton control="left" label="Move left" className="mobile-control mobile-control--left">
          <MoveLeft aria-hidden="true" />
        </ControlButton>
        <span className="mobile-dpad__core" aria-hidden="true" />
        <ControlButton control="right" label="Move right" className="mobile-control mobile-control--right">
          <MoveRight aria-hidden="true" />
        </ControlButton>
        <ControlButton control="down" label="Move backward" className="mobile-control mobile-control--down">
          <MoveDown aria-hidden="true" />
        </ControlButton>
      </div>
      <div className="mobile-actions">
        <ControlButton control="dash" label="Phase dash" className="mobile-action mobile-action--dash">
          <ChevronsUp aria-hidden="true" />
          <span>Dash</span>
        </ControlButton>
        <ControlButton control="pulse" label="Overdrive pulse" className="mobile-action mobile-action--pulse">
          <Zap aria-hidden="true" fill="currentColor" />
          <span>Pulse</span>
        </ControlButton>
      </div>
    </div>
  )
}
