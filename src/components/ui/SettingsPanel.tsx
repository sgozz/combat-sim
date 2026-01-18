/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect } from 'react'

type ColorMode = 'default' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'high-contrast'
type FontSize = 'small' | 'medium' | 'large'

type Settings = {
  colorMode: ColorMode
  fontSize: FontSize
}

const COLOR_MODE_LABELS: Record<ColorMode, string> = {
  'default': 'Default',
  'protanopia': 'Protanopia (Red-Blind)',
  'deuteranopia': 'Deuteranopia (Green-Blind)',
  'tritanopia': 'Tritanopia (Blue-Blind)',
  'high-contrast': 'High Contrast'
}

const FONT_SIZE_LABELS: Record<FontSize, string> = {
  'small': 'Small',
  'medium': 'Medium (Default)',
  'large': 'Large'
}

const STORAGE_KEY = 'tcs.accessibility'

const loadSettings = (): Settings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored) as Settings
    }
  } catch {
    // localStorage may be unavailable (e.g., private browsing)
  }
  return { colorMode: 'default', fontSize: 'medium' }
}

const saveSettings = (settings: Settings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export const applyAccessibilitySettings = () => {
  const settings = loadSettings()
  const root = document.documentElement
  
  root.classList.remove('color-default', 'color-protanopia', 'color-deuteranopia', 'color-tritanopia', 'color-high-contrast')
  root.classList.add(`color-${settings.colorMode}`)
  
  root.classList.remove('font-small', 'font-medium', 'font-large')
  root.classList.add(`font-${settings.fontSize}`)
}

type SettingsPanelProps = {
  onClose: () => void
}

export const SettingsPanel = ({ onClose }: SettingsPanelProps) => {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  useEffect(() => {
    saveSettings(settings)
    applyAccessibilitySettings()
  }, [settings])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Accessibility Settings</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="settings-section">
            <h3>Color Vision</h3>
            <p className="settings-desc">
              Choose a color scheme optimized for your vision type.
            </p>
            <div className="settings-options">
              {(Object.keys(COLOR_MODE_LABELS) as ColorMode[]).map(mode => (
                <label key={mode} className="settings-radio">
                  <input
                    type="radio"
                    name="colorMode"
                    checked={settings.colorMode === mode}
                    onChange={() => setSettings(s => ({ ...s, colorMode: mode }))}
                  />
                  <span className="radio-label">{COLOR_MODE_LABELS[mode]}</span>
                  {mode !== 'default' && mode !== 'high-contrast' && (
                    <div className="color-preview">
                      <span className={`preview-swatch preview-good ${mode}`} />
                      <span className={`preview-swatch preview-warning ${mode}`} />
                      <span className={`preview-swatch preview-danger ${mode}`} />
                    </div>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div className="settings-section">
            <h3>Font Size</h3>
            <p className="settings-desc">
              Adjust the overall text size for better readability.
            </p>
            <div className="settings-options">
              {(Object.keys(FONT_SIZE_LABELS) as FontSize[]).map(size => (
                <label key={size} className="settings-radio">
                  <input
                    type="radio"
                    name="fontSize"
                    checked={settings.fontSize === size}
                    onChange={() => setSettings(s => ({ ...s, fontSize: size }))}
                  />
                  <span className="radio-label">{FONT_SIZE_LABELS[size]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="settings-section">
            <h3>Preview</h3>
            <div className="settings-preview">
              <div className="preview-item">
                <span className="preview-label">Success:</span>
                <span className="preview-value color-success">Hit! 15 damage</span>
              </div>
              <div className="preview-item">
                <span className="preview-label">Warning:</span>
                <span className="preview-value color-warning">Low HP (3/10)</span>
              </div>
              <div className="preview-item">
                <span className="preview-label">Danger:</span>
                <span className="preview-value color-danger">Critical Miss!</span>
              </div>
              <div className="preview-item">
                <span className="preview-label">Info:</span>
                <span className="preview-value color-info">Your turn</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="action-btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
