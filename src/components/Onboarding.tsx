import { ArrowUp, Gem, Radio, X, Zap } from 'lucide-react'

export interface OnboardingProps {
  visible: boolean
  score: number
  charge: number
  objective: string
  onDismiss: () => void
}

export function Onboarding({ visible, score, charge, objective, onDismiss }: OnboardingProps) {
  if (!visible) return null

  const bankReady = objective.toLowerCase().includes('reactor')
  const pulseReady = charge >= 100
  const step = pulseReady ? 3 : bankReady ? 2 : score > 0 ? 1 : 0
  const content = step === 0
    ? { icon: <ArrowUp />, eyebrow: 'Pilot link 01', title: 'Move the signal', copy: 'Use WASD, arrows, stick, or the touch pad. Hold SHIFT to phase dash.' }
    : step === 1
      ? { icon: <Gem />, eyebrow: 'Circuit link 02', title: 'Follow the beacon', copy: 'The bright vertical beam marks the next circuit color. Off-color shards still score.' }
      : step === 2
        ? { icon: <Radio />, eyebrow: 'Reactor link 03', title: 'Bank the circuit', copy: 'The gold reactor is armed. Cut back through the center to lock in the bonus.' }
        : { icon: <Zap />, eyebrow: 'Overdrive online', title: 'Break the grid', copy: 'Your core is full. Press SPACE to erase nearby hunters and jam a rival.' }

  return (
    <aside className="onboarding-card" aria-live="polite">
      <span className="onboarding-card__icon" aria-hidden="true">{content.icon}</span>
      <div>
        <small>{content.eyebrow}</small>
        <strong>{content.title}</strong>
        <p>{content.copy}</p>
        <span className="onboarding-card__steps" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => <i key={index} className={index <= step ? 'is-active' : ''} />)}
        </span>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss tutorial"><X size={16} /></button>
    </aside>
  )
}
