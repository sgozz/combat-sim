export type AnimationKey = 'idle' | 'walk' | 'run' | 'death' | 'dodge' | 'attack' | 'hit' | 'grapple' | 'crouch' | 'spell'

export type AnimationLibrary = 'classic' | 'quaternius'

export type WeaponType = 'sword' | 'dagger' | 'staff' | 'bow' | 'unarmed' | 'spell'

export type ModelEntry = {
  id: string
  label: string
  path: string
  rotationOffset: number
  animations: Record<AnimationKey, string>
  library: AnimationLibrary
  weaponType: WeaponType
}

const RPG_ROTATION = Math.PI / 2

const UAL1 = '/models/quaternius/UAL1_Standard.glb'

const UAL1_ANIMS: Record<AnimationKey, string> = {
  idle: 'Idle_Loop',
  walk: 'Walk_Loop',
  run: 'Sprint_Loop',
  death: 'Death01',
  dodge: 'Roll',
  attack: 'Sword_Attack',
  hit: 'Hit_Chest',
  grapple: 'Punch_Cross',
  crouch: 'Crouch_Idle_Loop',
  spell: 'Spell_Simple_Shoot',
}

export const MODEL_REGISTRY: Record<string, ModelEntry> = {
  warrior: {
    id: 'warrior',
    label: 'Warrior (Classic)',
    path: '/models/warrior.glb',
    rotationOffset: RPG_ROTATION,
    animations: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Run',
      death: 'Death',
      dodge: 'Roll',
      attack: 'Sword_Attack',
      hit: 'RecieveHit',
      grapple: 'Punch',
      crouch: 'Idle',
      spell: 'Idle',
    },
    library: 'classic',
    weaponType: 'sword',
  },
  rogue: {
    id: 'rogue',
    label: 'Rogue (Classic)',
    path: '/models/rogue.glb',
    rotationOffset: RPG_ROTATION,
    animations: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Run',
      death: 'Death',
      dodge: 'Roll',
      attack: 'Dagger_Attack',
      hit: 'RecieveHit',
      grapple: 'Punch',
      crouch: 'Idle',
      spell: 'Idle',
    },
    library: 'classic',
    weaponType: 'dagger',
  },
  wizard: {
    id: 'wizard',
    label: 'Wizard (Classic)',
    path: '/models/wizard.glb',
    rotationOffset: RPG_ROTATION,
    animations: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Run',
      death: 'Death',
      dodge: 'Roll',
      attack: 'Staff_Attack',
      hit: 'RecieveHit',
      grapple: 'Punch',
      crouch: 'Idle',
      spell: 'Spell1',
    },
    library: 'classic',
    weaponType: 'spell',
  },
  cleric: {
    id: 'cleric',
    label: 'Cleric (Classic)',
    path: '/models/cleric.glb',
    rotationOffset: RPG_ROTATION,
    animations: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Run',
      death: 'Death',
      dodge: 'Spell1',
      attack: 'Staff_Attack',
      hit: 'RecieveHit',
      grapple: 'Punch',
      crouch: 'Idle',
      spell: 'Spell2',
    },
    library: 'classic',
    weaponType: 'staff',
  },
  ranger: {
    id: 'ranger',
    label: 'Ranger (Classic)',
    path: '/models/ranger.glb',
    rotationOffset: RPG_ROTATION,
    animations: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Run',
      death: 'Death',
      dodge: 'Roll',
      attack: 'Bow_Shoot',
      hit: 'RecieveHit',
      grapple: 'Punch',
      crouch: 'Idle',
      spell: 'Idle',
    },
    library: 'classic',
    weaponType: 'bow',
  },
  monk: {
    id: 'monk',
    label: 'Monk (Classic)',
    path: '/models/monk.glb',
    rotationOffset: RPG_ROTATION,
    animations: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Run',
      death: 'Death',
      dodge: 'Roll',
      attack: 'Attack',
      hit: 'RecieveHit',
      grapple: 'Punch',
      crouch: 'Idle',
      spell: 'Idle',
    },
    library: 'classic',
    weaponType: 'unarmed',
  },
  quaternius_ual1: {
    id: 'quaternius_ual1',
    label: 'Mannequin (Quaternius)',
    path: UAL1,
    rotationOffset: 0,
    animations: { ...UAL1_ANIMS },
    library: 'quaternius',
    weaponType: 'sword',
  },

}

export const DEFAULT_MODEL_ID = 'quaternius_ual1'

export const MODEL_LIST = Object.values(MODEL_REGISTRY)

export function getAllPreloadPaths(): string[] {
  return MODEL_LIST.map(entry => entry.path)
}

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
