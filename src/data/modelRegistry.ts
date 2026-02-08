export type AnimationKey = 'idle' | 'walk' | 'run' | 'death' | 'jump' | 'punch' | 'working'

export type AnimationLibrary = 'classic' | 'quaternius'

export type WeaponType = 'sword' | 'dagger' | 'staff' | 'bow' | 'unarmed' | 'spell'

export type ModelEntry = {
  id: string
  label: string
  path: string
  scale: number
  rotationOffset: number
  animations: Record<AnimationKey, string>
  library: AnimationLibrary
  weaponType: WeaponType
}

const RPG_SCALE = 0.32
const RPG_ROTATION = Math.PI / 2

export const MODEL_REGISTRY: Record<string, ModelEntry> = {
  human: {
    id: 'human',
    label: 'Soldier (Classic)',
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
    library: 'classic',
    weaponType: 'unarmed',
  },
  warrior: {
    id: 'warrior',
    label: 'Warrior (Classic)',
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
    library: 'classic',
    weaponType: 'sword',
  },
  rogue: {
    id: 'rogue',
    label: 'Rogue (Classic)',
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
    library: 'classic',
    weaponType: 'dagger',
  },
  wizard: {
    id: 'wizard',
    label: 'Wizard (Classic)',
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
    library: 'classic',
    weaponType: 'spell',
  },
  cleric: {
    id: 'cleric',
    label: 'Cleric (Classic)',
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
    library: 'classic',
    weaponType: 'staff',
  },
  ranger: {
    id: 'ranger',
    label: 'Ranger (Classic)',
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
    library: 'classic',
    weaponType: 'bow',
  },
  monk: {
    id: 'monk',
    label: 'Monk (Classic)',
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
    library: 'classic',
    weaponType: 'unarmed',
  },
  quaternius_standard: {
    id: 'quaternius_standard',
    label: 'Quaternius (Standard)',
    path: '/models/quaternius/UAL2_Standard.glb',
    scale: 1.0,
    rotationOffset: 0,
    animations: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Run',
      death: 'Death',
      jump: 'Jump',
      punch: 'Punch_Combo_1',
      working: 'Idle_Combat',
    },
    library: 'quaternius',
    weaponType: 'unarmed',
  },
  quaternius_mannequin: {
    id: 'quaternius_mannequin',
    label: 'Quaternius (Mannequin)',
    path: '/models/quaternius/Mannequin_F.glb',
    scale: 1.0,
    rotationOffset: 0,
    animations: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Run',
      death: 'Death',
      jump: 'Jump',
      punch: 'Attack',
      working: 'Idle_Pose',
    },
    library: 'quaternius',
    weaponType: 'unarmed',
  },
}

export const DEFAULT_MODEL_ID = 'warrior'

export const MODEL_LIST = Object.values(MODEL_REGISTRY)

export function getModelEntry(modelId: string | undefined): ModelEntry {
  return MODEL_REGISTRY[modelId ?? DEFAULT_MODEL_ID] ?? MODEL_REGISTRY[DEFAULT_MODEL_ID]
}

export function getModelsByLibrary(library: AnimationLibrary): ModelEntry[] {
  return MODEL_LIST.filter(model => model.library === library)
}

export function getClassicModels(): ModelEntry[] {
  return getModelsByLibrary('classic')
}

export function getQuaterniusModels(): ModelEntry[] {
  return getModelsByLibrary('quaternius')
}
