export type AnimationKey = 'idle' | 'walk' | 'run' | 'death' | 'jump' | 'punch' | 'working'

export type AnimationLibrary = 'classic' | 'quaternius'

export type WeaponType = 'sword' | 'dagger' | 'staff' | 'bow' | 'unarmed' | 'spell'

export type CompositeModel = {
  body: string
  outfit?: string
  weapon?: string
  animationSrc: string
}

export type ModelEntry = {
  id: string
  label: string
  path: string
  rotationOffset: number
  animations: Record<AnimationKey, string>
  library: AnimationLibrary
  weaponType: WeaponType
  composite?: CompositeModel
}

const RPG_ROTATION = Math.PI / 2

const UAL1 = '/models/quaternius/UAL1_Standard.glb'
const BODY_M = '/models/quaternius/characters/Superhero_Male.glb'
const BODY_F = '/models/quaternius/characters/Superhero_Female.glb'
const OUTFIT_RANGER_M = '/models/quaternius/outfits/Male_Ranger.glb'
const OUTFIT_PEASANT_M = '/models/quaternius/outfits/Male_Peasant.glb'
const OUTFIT_RANGER_F = '/models/quaternius/outfits/Female_Ranger.glb'
const OUTFIT_PEASANT_F = '/models/quaternius/outfits/Female_Peasant.glb'
const WEAPON_SWORD = '/models/quaternius/weapons/Sword_Bronze.glb'
const WEAPON_AXE = '/models/quaternius/weapons/Axe_Bronze.glb'
const WEAPON_TORCH = '/models/quaternius/weapons/Torch_Metal.glb'

const UAL1_ANIMS: Record<AnimationKey, string> = {
  idle: 'Idle_Loop',
  walk: 'Walk_Loop',
  run: 'Sprint_Loop',
  death: 'Death01',
  jump: 'Roll',
  punch: 'Sword_Attack',
  working: 'Sword_Idle',
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
  quaternius_ual1: {
    id: 'quaternius_ual1',
    label: 'Mannequin (Quaternius)',
    path: UAL1,
    rotationOffset: 0,
    animations: { ...UAL1_ANIMS },
    library: 'quaternius',
    weaponType: 'sword',
  },
  quaternius_ranger_m: {
    id: 'quaternius_ranger_m',
    label: 'Ranger M (Quaternius)',
    path: UAL1,
    rotationOffset: 0,
    animations: { ...UAL1_ANIMS },
    library: 'quaternius',
    weaponType: 'sword',
    composite: {
      body: BODY_M,
      outfit: OUTFIT_RANGER_M,
      weapon: WEAPON_SWORD,
      animationSrc: UAL1,
    },
  },
  quaternius_peasant_m: {
    id: 'quaternius_peasant_m',
    label: 'Peasant M (Quaternius)',
    path: UAL1,
    rotationOffset: 0,
    animations: { ...UAL1_ANIMS },
    library: 'quaternius',
    weaponType: 'unarmed',
    composite: {
      body: BODY_M,
      outfit: OUTFIT_PEASANT_M,
      weapon: WEAPON_AXE,
      animationSrc: UAL1,
    },
  },
  quaternius_ranger_f: {
    id: 'quaternius_ranger_f',
    label: 'Ranger F (Quaternius)',
    path: UAL1,
    rotationOffset: 0,
    animations: { ...UAL1_ANIMS },
    library: 'quaternius',
    weaponType: 'sword',
    composite: {
      body: BODY_F,
      outfit: OUTFIT_RANGER_F,
      weapon: WEAPON_SWORD,
      animationSrc: UAL1,
    },
  },
  quaternius_peasant_f: {
    id: 'quaternius_peasant_f',
    label: 'Peasant F (Quaternius)',
    path: UAL1,
    rotationOffset: 0,
    animations: { ...UAL1_ANIMS },
    library: 'quaternius',
    weaponType: 'unarmed',
    composite: {
      body: BODY_F,
      outfit: OUTFIT_PEASANT_F,
      weapon: WEAPON_TORCH,
      animationSrc: UAL1,
    },
  },
}

export const DEFAULT_MODEL_ID = 'warrior'

export const MODEL_LIST = Object.values(MODEL_REGISTRY)

/** Collect every unique GLB path that needs preloading */
export function getAllPreloadPaths(): string[] {
  const paths = new Set<string>()
  for (const entry of MODEL_LIST) {
    paths.add(entry.path)
    if (entry.composite) {
      paths.add(entry.composite.body)
      if (entry.composite.outfit) paths.add(entry.composite.outfit)
      if (entry.composite.weapon) paths.add(entry.composite.weapon)
      paths.add(entry.composite.animationSrc)
    }
  }
  return [...paths]
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
