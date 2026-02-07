export type AnimationKey = 'idle' | 'walk' | 'run' | 'death' | 'jump' | 'punch' | 'working'

export type ModelEntry = {
  id: string
  label: string
  path: string
  scale: number
  rotationOffset: number
  animations: Record<AnimationKey, string>
}

const RPG_SCALE = 0.32
const RPG_ROTATION = Math.PI / 2

export const MODEL_REGISTRY: Record<string, ModelEntry> = {
  human: {
    id: 'human',
    label: 'Soldier',
    path: '/models/human.glb',
    scale: 0.342,
    rotationOffset: Math.PI / 2,
    animations: {
      idle: 'Human Armature|Idle',
      walk: 'Human Armature|Walk',
      run: 'Human Armature|Run',
      death: 'Human Armature|Death',
      jump: 'Human Armature|Jump',
      punch: 'Human Armature|Punch',
      working: 'Human Armature|Working',
    },
  },
  warrior: {
    id: 'warrior',
    label: 'Warrior',
    path: '/models/warrior.glb',
    scale: RPG_SCALE,
    rotationOffset: RPG_ROTATION,
    animations: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Run',
      death: 'Death',
      jump: 'Roll',
      punch: 'Sword_Attack',
      working: 'Idle_Weapon',
    },
  },
  rogue: {
    id: 'rogue',
    label: 'Rogue',
    path: '/models/rogue.glb',
    scale: RPG_SCALE,
    rotationOffset: RPG_ROTATION,
    animations: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Run',
      death: 'Death',
      jump: 'Roll',
      punch: 'Dagger_Attack',
      working: 'Attacking_Idle',
    },
  },
  wizard: {
    id: 'wizard',
    label: 'Wizard',
    path: '/models/wizard.glb',
    scale: RPG_SCALE,
    rotationOffset: RPG_ROTATION,
    animations: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Run',
      death: 'Death',
      jump: 'Roll',
      punch: 'Spell1',
      working: 'Idle_Weapon',
    },
  },
  cleric: {
    id: 'cleric',
    label: 'Cleric',
    path: '/models/cleric.glb',
    scale: RPG_SCALE,
    rotationOffset: RPG_ROTATION,
    animations: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Run',
      death: 'Death',
      jump: 'Spell1',
      punch: 'Staff_Attack',
      working: 'Idle_Weapon',
    },
  },
  ranger: {
    id: 'ranger',
    label: 'Ranger',
    path: '/models/ranger.glb',
    scale: RPG_SCALE,
    rotationOffset: RPG_ROTATION,
    animations: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Run',
      death: 'Death',
      jump: 'Roll',
      punch: 'Bow_Shoot',
      working: 'Idle_Weapon',
    },
  },
  monk: {
    id: 'monk',
    label: 'Monk',
    path: '/models/monk.glb',
    scale: RPG_SCALE,
    rotationOffset: RPG_ROTATION,
    animations: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Run',
      death: 'Death',
      jump: 'Roll',
      punch: 'Attack',
      working: 'Idle_Attacking',
    },
  },
}

export const DEFAULT_MODEL_ID = 'warrior'

export const MODEL_LIST = Object.values(MODEL_REGISTRY)

export function getModelEntry(modelId: string | undefined): ModelEntry {
  return MODEL_REGISTRY[modelId ?? DEFAULT_MODEL_ID] ?? MODEL_REGISTRY[DEFAULT_MODEL_ID]
}
