import { useRef, useEffect } from 'react'

const getLogIcon = (text: string): string => {
  if (/attacks/i.test(text)) return '⚔️'
  if (/hit|damage/i.test(text)) return '💥'
  if (/defended|parry|block|dodge/i.test(text)) return '🛡️'
  if (/miss/i.test(text)) return '💨'
  if (/moves/i.test(text)) return '👣'
  if (/chooses/i.test(text)) return '📋'
  if (/unconscious/i.test(text)) return '💀'
  if (/wins/i.test(text)) return '🏆'
  return 'ℹ️'
}

const getLogColor = (text: string): string => {
  if (/hit|damage/i.test(text)) return '#ff4444'
  if (/defended|parry|block/i.test(text)) return '#646cff'
  if (/miss/i.test(text)) return '#888'
  if (/moves|chooses/i.test(text)) return '#888'
  if (/wins/i.test(text)) return '#4f4'
  if (/unconscious/i.test(text)) return '#f44'
  return '#ccc'
}

const LogEntry = ({ text, index }: { text: string; index: number }) => {
  const icon = getLogIcon(text)
  const color = getLogColor(text)
  const isEven = index % 2 === 0
  
  return (
    <div 
      className={`combat-log-entry ${isEven ? 'even' : 'odd'}`}
      style={{ color }}
    >
      <span className="log-icon">{icon}</span>
      <span className="log-text">{text}</span>
    </div>
  )
}

export const CombatLog = ({ logs }: { logs: string[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const reversedLogs = [...logs].reverse()

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [logs])

  return (
    <div className="card combat-log-card">
      <h3>Combat Log</h3>
      <div className="combat-log-entries" ref={scrollRef}>
        {reversedLogs.map((log, i) => (
          <LogEntry key={`${logs.length - i}-${log}`} text={log} index={i} />
        ))}
        {reversedLogs.length === 0 && (
          <div className="empty-log">No entries</div>
        )}
      </div>
    </div>
  )
}
