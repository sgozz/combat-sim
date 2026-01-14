import { useRef, useEffect } from 'react'

const RichLogEntry = ({ text }: { text: string }) => {
  const parts = text.split(/(\b(?:attacks|hit|damage|miss|defended|moves|chooses)\b|\d+)/g)
  
  return (
    <div className="log-entry">
      {parts.map((part, i) => {
        if (part === 'attacks' || part === 'hit' || part === 'damage') return <span key={i} style={{color: '#ff4444', fontWeight: part === 'hit' ? 'bold' : 'normal'}}>{part}</span>
        if (part === 'miss') return <span key={i} style={{color: '#888'}}>{part}</span>
        if (part === 'defended') return <span key={i} style={{color: '#646cff'}}>{part}</span>
        if (part === 'moves' || part === 'chooses') return <span key={i} style={{color: '#44ff44'}}>{part}</span>
        if (/^\d+$/.test(part)) return <span key={i} style={{color: 'white', fontWeight: 'bold'}}>{part}</span>
        return part
      })}
    </div>
  )
}

export const CombatLog = ({ logs }: { logs: string[] }) => {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '0' }}>
      <h3>Combat Log</h3>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: '100px', display: 'flex', flexDirection: 'column' }}>
        {logs.map((log, i) => (
          <RichLogEntry key={i} text={log} />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}
