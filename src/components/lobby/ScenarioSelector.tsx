import type { BiomeId } from '../../../shared/map/types'
import './ScenarioSelector.css'

type ScenarioOption = {
  id: BiomeId | null
  name: string
  icon: string
  description: string
}

const SCENARIOS: ScenarioOption[] = [
  {
    id: null,
    name: 'No Scenario',
    icon: '⬜',
    description: 'Classic empty grid — no terrain or obstacles',
  },
  {
    id: 'dungeon',
    name: 'Dungeon',
    icon: '🏰',
    description: 'Rooms and corridors with walls, pillars, and crates',
  },
  {
    id: 'wilderness',
    name: 'Wilderness',
    icon: '🌲',
    description: 'Open field with trees, rocks, and bushes',
  },
  {
    id: 'desert',
    name: 'Desert',
    icon: '🏜️',
    description: 'Arid wasteland with cacti, rocks, and bones',
  },
  {
    id: 'graveyard',
    name: 'Graveyard',
    icon: '🪦',
    description: 'Haunted grounds with tombs, gravestones, and dead trees',
  },
]

type ScenarioSelectorProps = {
  selectedBiome: BiomeId | null
  onBiomeSelect: (biome: BiomeId | null) => void
  disabled?: boolean
}

export const ScenarioSelector = ({
  selectedBiome,
  onBiomeSelect,
  disabled = false,
}: ScenarioSelectorProps) => {
  return (
    <div className="scenario-selector">
      <div className="scenario-selector-options">
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.id ?? 'none'}
            type="button"
            className={`scenario-selector-option ${
              selectedBiome === scenario.id ? 'scenario-selector-option--selected' : ''
            }`}
            onClick={() => onBiomeSelect(scenario.id)}
            disabled={disabled}
          >
            <span className="scenario-selector-icon">{scenario.icon}</span>
            <span className="scenario-selector-name">{scenario.name}</span>
            <span className="scenario-selector-desc">{scenario.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
