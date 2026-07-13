import { Crown, Gem, Home, Radio, RotateCcw, Sparkles, Target, Trophy, Zap } from 'lucide-react'
import { CUBE_COLORS } from '../game/constants'
import type { RecordRunResult } from '../game/progression'
import type { CubeColor, GameMode, LeaderboardEntry, RivalSnapshot, RunSummary } from '../game/types'

export interface ResultsScreenProps {
  result: RunSummary
  mode: GameMode
  playerName: string
  playerColor: CubeColor
  leaderboard?: LeaderboardEntry[]
  leaderboardRank?: number | null
  rival?: RivalSnapshot | null
  progressionReward?: RecordRunResult | null
  notice?: string
  onPlayAgain: () => void
  onMainMenu: () => void
}

const scoreFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

const formatDuration = (seconds: number) => {
  const wholeSeconds = Math.max(0, Math.round(seconds))
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`
}

const medalLabel = (position: number) => {
  if (position === 0) return '1st'
  if (position === 1) return '2nd'
  if (position === 2) return '3rd'
  return `${position + 1}th`
}

export function ResultsScreen({
  result,
  mode,
  playerName,
  playerColor,
  leaderboard = [],
  leaderboardRank = null,
  rival = null,
  progressionReward = null,
  notice = '',
  onPlayAgain,
  onMainMenu,
}: ResultsScreenProps) {
  const fallbackEntry: LeaderboardEntry = {
    id: 'current-run',
    name: playerName,
    score: result.score,
    combo: result.bestCombo,
    color: playerColor,
    createdAt: 0,
    isPlayer: true,
  }
  const archived = leaderboard
    .filter((entry) => !(entry.name === playerName && entry.score === result.score && entry.combo === result.bestCombo))
    .map((entry) => ({ ...entry, isPlayer: false }))
  const allStandings = [...archived, fallbackEntry]
    .sort((left, right) => right.score - left.score || right.combo - left.combo)
  const playerIndex = allStandings.findIndex((entry) => entry.id === 'current-run')
  const playerRank = leaderboardRank && leaderboardRank > 0 ? leaderboardRank : playerIndex + 1
  const standings = playerRank <= 6
    ? allStandings.slice(0, 6)
    : [...allStandings.slice(0, 5), allStandings[playerIndex]]
  const isDuel = mode !== 'solo'
  const tied = Boolean(isDuel && rival && result.score === rival.score)
  const victory = tied ? false : isDuel ? result.won !== false : true
  const scoreDelta = rival ? result.score - rival.score : 0

  return (
    <section className="screen-overlay results-screen" aria-labelledby="results-title">
      <div className="results-screen__burst" aria-hidden="true" />
      <div className="results-panel glass-panel">
        <header className={`results-hero${tied ? ' results-hero--draw' : victory ? ' results-hero--victory' : ' results-hero--defeat'}`}>
          <span className="results-hero__icon" aria-hidden="true">
            {victory ? <Trophy size={36} /> : <Radio size={36} />}
          </span>
          <span className="results-hero__eyebrow">{isDuel ? 'Duel transmission complete' : 'Run archived locally'}</span>
          <h1 id="results-title">{isDuel ? (tied ? 'Signal deadlock' : victory ? 'Grid conquered' : 'Signal outrun') : 'Overdrive complete'}</h1>
          <p>
            {tied
              ? `${playerName}, neither signal yielded. Run it back.`
              : victory
              ? `${playerName}, your signal lit up the arena.`
              : `${playerName}, rematch the rival and reclaim the grid.`}
          </p>
        </header>

        {isDuel && rival ? (
          <div className="duel-result-strip">
            <span><small>{playerName}</small><strong>{scoreFormatter.format(result.score)}</strong></span>
            <b>{tied ? 'DRAW' : scoreDelta > 0 ? `+${scoreFormatter.format(scoreDelta)}` : scoreFormatter.format(scoreDelta)}</b>
            <span><small>{rival.name}</small><strong>{scoreFormatter.format(rival.score)}</strong></span>
          </div>
        ) : null}

        <div className="results-layout">
          <section className="run-summary" aria-labelledby="run-summary-heading">
            <span id="run-summary-heading" className="run-summary__label">
              Final signal
            </span>
            <strong className="run-summary__score">{scoreFormatter.format(result.score)}</strong>
            <span className="run-summary__rank">
              <Sparkles aria-hidden="true" size={15} />
              {playerRank > 0 ? `Rank ${playerRank} in device archive` : 'Unranked signal'}
            </span>

            {progressionReward ? (
              <div className="progression-reward">
                <span><strong>+{scoreFormatter.format(progressionReward.xpEarned)} XP</strong> · Level {progressionReward.progression.level}</span>
                {progressionReward.newlyUnlockedAchievements.slice(0, 2).map((achievement) => (
                  <em key={achievement.id}>Achievement // {achievement.title}</em>
                ))}
                {progressionReward.newlyUnlockedTrails.slice(0, 1).map((trail) => (
                  <em key={trail.id}>Trail unlocked // {trail.label}</em>
                ))}
              </div>
            ) : null}

            <dl className="run-stats">
              <div>
                <dt>
                  <Zap aria-hidden="true" size={16} /> Best chain
                </dt>
                <dd>{result.bestCombo}</dd>
              </div>
              <div>
                <dt>
                  <Gem aria-hidden="true" size={16} /> Shards
                </dt>
                <dd>{result.shards}</dd>
              </div>
              <div>
                <dt>
                  <Target aria-hidden="true" size={16} /> Drones
                </dt>
                <dd>{result.drones}</dd>
              </div>
              <div>
                <dt>
                  <Crown aria-hidden="true" size={16} /> Banks
                </dt>
                <dd>{result.banks}</dd>
              </div>
              <div className="run-stats__wide">
                <dt>Run time</dt>
                <dd>{formatDuration(result.duration)}</dd>
              </div>
            </dl>
          </section>

          <section className="leaderboard-card" aria-labelledby="leaderboard-heading">
            <header className="leaderboard-card__header">
              <div>
                <span>On-device archive</span>
                <h2 id="leaderboard-heading">Top signals</h2>
              </div>
              <Trophy aria-hidden="true" size={21} />
            </header>

            <ol className="leaderboard-list">
              {standings.map((entry) => {
                const highlighted = entry.isPlayer || entry.name === playerName
                const actualRank = entry.id === 'current-run'
                  ? playerRank
                  : allStandings.findIndex((candidate) => candidate.id === entry.id) + 1
                return (
                  <li key={entry.id} className={highlighted ? 'leaderboard-row leaderboard-row--player' : 'leaderboard-row'}>
                    <span className={`leaderboard-row__rank leaderboard-row__rank--${Math.min(actualRank, 4)}`}>
                      {actualRank === 1 ? <Crown aria-hidden="true" size={15} /> : medalLabel(actualRank - 1)}
                    </span>
                    <span
                      className="leaderboard-row__signal"
                      style={{ background: CUBE_COLORS[entry.color].primary }}
                      aria-hidden="true"
                    />
                    <span className="leaderboard-row__pilot">
                      <strong>{entry.name}</strong>
                      <small>Best chain {entry.combo}</small>
                    </span>
                    <strong className="leaderboard-row__score">{scoreFormatter.format(entry.score)}</strong>
                  </li>
                )
              })}
            </ol>
          </section>
        </div>

        <footer className="results-actions">
          {notice ? <span className="results-notice" role="status">{notice}</span> : null}
          <button className="button button--ghost" type="button" onClick={onMainMenu}>
            <Home aria-hidden="true" size={18} /> Main menu
          </button>
          <button className="button button--primary" type="button" onClick={onPlayAgain}>
            <RotateCcw aria-hidden="true" size={18} /> {isDuel ? 'Run it back' : 'New run'}
          </button>
        </footer>
      </div>
    </section>
  )
}
