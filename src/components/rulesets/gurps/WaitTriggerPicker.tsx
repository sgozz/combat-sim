import { useState } from 'react'
import type { WaitTrigger, WaitTriggerCondition, WaitTriggerAction, Id } from '../../../../shared/types'

type WaitTriggerPickerProps = {
  onSetTrigger: (trigger: WaitTrigger) => void
  enemies: Array<{ id: Id; name: string }>
  onCancel?: () => void
}

const CONDITIONS: { value: WaitTriggerCondition; label: string; desc: string }[] = [
  { value: 'enemy_moves_adjacent', label: 'Enemy moves next to me', desc: 'Trigger when an enemy enters an adjacent hex' },
  { value: 'enemy_enters_reach', label: 'Enemy enters my reach', desc: 'Trigger when an enemy comes within weapon reach' },
  { value: 'enemy_attacks_me', label: 'Enemy attacks me', desc: 'Trigger when an enemy declares an attack on me' },
  { value: 'enemy_attacks_ally', label: 'Enemy attacks an ally', desc: 'Trigger when an enemy attacks a friendly character' },
]

const ACTIONS: { value: WaitTriggerAction; label: string; icon: string }[] = [
  { value: 'attack', label: 'Attack', icon: '⚔️' },
  { value: 'move', label: 'Move', icon: '🏃' },
  { value: 'ready', label: 'Ready', icon: '🗡️' },
]

export const WaitTriggerPicker = ({ onSetTrigger, enemies, onCancel }: WaitTriggerPickerProps) => {
  const [condition, setCondition] = useState<WaitTriggerCondition>('enemy_moves_adjacent')
  const [targetId, setTargetId] = useState<Id | undefined>(undefined)
  const [action, setAction] = useState<WaitTriggerAction>('attack')

  const handleConfirm = () => {
    onSetTrigger({
      condition,
      targetId: targetId === 'any' ? undefined : targetId,
      action
    })
  }

  return (
    <div className="wait-trigger-picker">
      <div className="wait-header">
        <h3>Wait Condition</h3>
        {onCancel && (
          <button className="close-btn" onClick={onCancel}>×</button>
        )}
      </div>

      <div className="wait-section">
        <label className="section-label">Trigger When...</label>
        <div className="options-grid">
          {CONDITIONS.map((c) => (
            <div 
              key={c.value} 
              className={`trigger-option ${condition === c.value ? 'selected' : ''}`}
              onClick={() => setCondition(c.value)}
            >
              <div className="radio-circle"></div>
              <div className="option-text">
                <span className="option-label">{c.label}</span>
                <span className="option-desc">{c.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="wait-section">
        <label className="section-label">Specific Target (Optional)</label>
        <select 
          className="target-select"
          value={targetId ?? 'any'}
          onChange={(e) => setTargetId(e.target.value === 'any' ? undefined : e.target.value)}
        >
          <option value="any">Any Enemy</option>
          {enemies.map(enemy => (
            <option key={enemy.id} value={enemy.id}>{enemy.name}</option>
          ))}
        </select>
      </div>

      <div className="wait-section">
        <label className="section-label">Response Action</label>
        <div className="action-options-row">
          {ACTIONS.map((a) => (
            <button
              key={a.value}
              className={`response-btn ${action === a.value ? 'selected' : ''}`}
              onClick={() => setAction(a.value)}
            >
              <span className="response-icon">{a.icon}</span>
              <span className="response-label">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      <button className="confirm-wait-btn" onClick={handleConfirm}>
        <span className="btn-icon">⏳</span>
        Confirm Wait
      </button>
    </div>
  )
}
