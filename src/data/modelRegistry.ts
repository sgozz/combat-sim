export type AnimationKey = 'idle' | 'walk' | 'run' | 'death' | 'dodge' | 'attack' | 'hit' | 'grapple' | 'crouch' | 'spell'

export type AnimationLibrary = 'classic' | 'quaternius' | 'monster' | 'synty'

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
  synty_bean_male: {
    id: 'synty_bean_male',
    label: 'Bean Male (Synty)',
    path: '/models/synty-starter/SyntyBean_Male.glb',
    rotationOffset: 0,
    animations: { ...UAL1_ANIMS },
    library: 'synty',
    weaponType: 'sword',
  },
  synty_bean_female: {
    id: 'synty_bean_female',
    label: 'Bean Female (Synty)',
    path: '/models/synty-starter/SyntyBean_Female.glb',
    rotationOffset: 0,
    animations: { ...UAL1_ANIMS },
    library: 'synty',
    weaponType: 'sword',
  },

  // --- Monster models (Quaternius, CC0) ---

  monster_goblin: {
    id: 'monster_goblin',
    label: 'Goblin',
    path: '/models/monsters/goblin.glb',
    rotationOffset: 0,
    animations: {
      idle: 'CharacterArmature|Idle',
      walk: 'CharacterArmature|Walk',
      run: 'CharacterArmature|Run',
      death: 'CharacterArmature|Death',
      dodge: 'CharacterArmature|Duck',
      attack: 'CharacterArmature|Punch',
      hit: 'CharacterArmature|HitReact',
      grapple: 'CharacterArmature|Weapon',
      crouch: 'CharacterArmature|Duck',
      spell: 'CharacterArmature|Wave',
    },
    library: 'monster',
    weaponType: 'unarmed',
  },
  monster_orc: {
    id: 'monster_orc',
    label: 'Orc',
    path: '/models/monsters/orc.glb',
    rotationOffset: 0,
    animations: {
      idle: 'CharacterArmature|Idle',
      walk: 'CharacterArmature|Walk',
      run: 'CharacterArmature|Run',
      death: 'CharacterArmature|Death',
      dodge: 'CharacterArmature|Duck',
      attack: 'CharacterArmature|Punch',
      hit: 'CharacterArmature|HitReact',
      grapple: 'CharacterArmature|Weapon',
      crouch: 'CharacterArmature|Duck',
      spell: 'CharacterArmature|Wave',
    },
    library: 'monster',
    weaponType: 'unarmed',
  },
  monster_skeleton: {
    id: 'monster_skeleton',
    label: 'Skeleton',
    path: '/models/monsters/skeleton.glb',
    rotationOffset: 0,
    animations: {
      idle: 'EnemyArmature|EnemyArmature|EnemyArmature|Idle',
      walk: 'EnemyArmature|EnemyArmature|EnemyArmature|Walk',
      run: 'EnemyArmature|EnemyArmature|EnemyArmature|Run',
      death: 'EnemyArmature|EnemyArmature|EnemyArmature|Death',
      dodge: 'EnemyArmature|EnemyArmature|EnemyArmature|Jump',
      attack: 'EnemyArmature|EnemyArmature|EnemyArmature|Attack',
      hit: 'EnemyArmature|EnemyArmature|EnemyArmature|HitRecieve',
      grapple: 'EnemyArmature|EnemyArmature|EnemyArmature|Attack',
      crouch: 'EnemyArmature|EnemyArmature|EnemyArmature|Idle',
      spell: 'EnemyArmature|EnemyArmature|EnemyArmature|Jump',
    },
    library: 'monster',
    weaponType: 'sword',
  },
  monster_demon: {
    id: 'monster_demon',
    label: 'Demon',
    path: '/models/monsters/demon.glb',
    rotationOffset: 0,
    animations: {
      idle: 'CharacterArmature|Flying_Idle',
      walk: 'CharacterArmature|Fast_Flying',
      run: 'CharacterArmature|Fast_Flying',
      death: 'CharacterArmature|Death',
      dodge: 'CharacterArmature|No',
      attack: 'CharacterArmature|Punch',
      hit: 'CharacterArmature|HitReact',
      grapple: 'CharacterArmature|Headbutt',
      crouch: 'CharacterArmature|Flying_Idle',
      spell: 'CharacterArmature|Yes',
    },
    library: 'monster',
    weaponType: 'unarmed',
  },
  monster_ghost: {
    id: 'monster_ghost',
    label: 'Ghost',
    path: '/models/monsters/ghost.glb',
    rotationOffset: 0,
    animations: {
      idle: 'CharacterArmature|Flying_Idle',
      walk: 'CharacterArmature|Fast_Flying',
      run: 'CharacterArmature|Fast_Flying',
      death: 'CharacterArmature|Death',
      dodge: 'CharacterArmature|No',
      attack: 'CharacterArmature|Punch',
      hit: 'CharacterArmature|HitReact',
      grapple: 'CharacterArmature|Headbutt',
      crouch: 'CharacterArmature|Flying_Idle',
      spell: 'CharacterArmature|Yes',
    },
    library: 'monster',
    weaponType: 'unarmed',
  },
  monster_wolf: {
    id: 'monster_wolf',
    label: 'Wolf',
    path: '/models/monsters/wolf.glb',
    rotationOffset: 0,
    animations: {
      idle: 'AnimalArmature|Idle',
      walk: 'AnimalArmature|Walk',
      run: 'AnimalArmature|Gallop',
      death: 'AnimalArmature|Death',
      dodge: 'AnimalArmature|Gallop_Jump',
      attack: 'AnimalArmature|Attack',
      hit: 'AnimalArmature|Idle_HitReact_Left',
      grapple: 'AnimalArmature|Attack',
      crouch: 'AnimalArmature|Eating',
      spell: 'AnimalArmature|Idle_2',
    },
    library: 'monster',
    weaponType: 'unarmed',
  },
  monster_spider: {
    id: 'monster_spider',
    label: 'Spider',
    path: '/models/monsters/spider.glb',
    rotationOffset: 0,
    animations: {
      idle: 'SpiderArmature|Spider_Idle',
      walk: 'SpiderArmature|Spider_Walk',
      run: 'SpiderArmature|Spider_Walk',
      death: 'SpiderArmature|Spider_Death',
      dodge: 'SpiderArmature|Spider_Jump',
      attack: 'SpiderArmature|Spider_Attack',
      hit: 'SpiderArmature|Spider_Jump',
      grapple: 'SpiderArmature|Spider_Attack',
      crouch: 'SpiderArmature|Spider_Idle',
      spell: 'SpiderArmature|Spider_Jump',
    },
    library: 'monster',
    weaponType: 'unarmed',
  },
  monster_skull: {
    id: 'monster_skull',
    label: 'Skull',
    path: '/models/monsters/skull.glb',
    rotationOffset: 0,
    animations: {
      idle: 'MonsterArmature|Idle',
      walk: 'MonsterArmature|Walk',
      run: 'MonsterArmature|Walk',
      death: 'MonsterArmature|Death',
      dodge: 'MonsterArmature|Jump',
      attack: 'MonsterArmature|Bite_Front',
      hit: 'MonsterArmature|HitRecieve',
      grapple: 'MonsterArmature|Bite_InPlace',
      crouch: 'MonsterArmature|Idle',
      spell: 'MonsterArmature|Dance',
    },
    library: 'monster',
    weaponType: 'unarmed',
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

export function getMonsterModels(): ModelEntry[] {
  return getModelsByLibrary('monster')
}

export function getSyntyModels(): ModelEntry[] {
  return getModelsByLibrary('synty')
}
