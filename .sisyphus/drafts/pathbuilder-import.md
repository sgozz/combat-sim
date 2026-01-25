# Draft: Pathbuilder 2e Import

## Requirements (confirmed)
- Supportare import personaggi PF2e dal formato Pathbuilder 2e
- Supportare import tramite Character ID (API fetch)
- Supportare import tramite JSON file upload (TBD: confermare con utente)

## Research Findings

### Pathbuilder 2e API
- **Endpoint**: `https://pathbuilder2e.com/json.php?id={characterId}`
- **Response format**: `{ success: boolean, build: PathbuilderCharacter }`
- **Character ID**: numero intero visibile nell'app Pathbuilder

### JSON Structure (completa)
```typescript
interface PathbuilderExport {
  success: boolean;
  build: {
    // Identity
    name: string;
    class: string;
    dualClass: string | null;
    level: number;
    ancestry: string;
    heritage: string;
    background: string;
    alignment: string;
    gender: string;
    age: string;
    deity: string;
    
    // Size
    size: number;        // 0=Tiny, 1=Small, 2=Medium, 3=Large, 4=Huge, 5=Gargantuan
    sizeName: string;
    
    // Core
    keyability: string;  // 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
    languages: string[];
    
    // Attributes
    attributes: {
      ancestryhp: number;
      classhp: number;
      bonushp: number;
      bonushpPerLevel: number;
      speed: number;
      speedBonus: number;
    };
    
    // Abilities (final calculated values)
    abilities: {
      str: number;
      dex: number;
      con: number;
      int: number;
      wis: number;
      cha: number;
      breakdown: { /* how boosts applied */ };
    };
    
    // Proficiencies (0=untrained, 2=trained, 4=expert, 6=master, 8=legendary)
    proficiencies: {
      classDC: number;
      perception: number;
      fortitude: number;
      reflex: number;
      will: number;
      // armor
      heavy: number;
      medium: number;
      light: number;
      unarmored: number;
      // weapons
      advanced: number;
      martial: number;
      simple: number;
      unarmed: number;
      // casting
      castingArcane: number;
      castingDivine: number;
      castingOccult: number;
      castingPrimal: number;
      // skills
      acrobatics: number;
      arcana: number;
      athletics: number;
      crafting: number;
      deception: number;
      diplomacy: number;
      intimidation: number;
      medicine: number;
      nature: number;
      occultism: number;
      performance: number;
      religion: number;
      society: number;
      stealth: number;
      survival: number;
      thievery: number;
    };
    
    // Feats: [name, extra?, type, level, slot?, choiceType?, parentRef?]
    feats: [string, string | null, string, number, string?, string?, string?][];
    
    // Class features, ancestry abilities
    specials: string[];
    
    // Lores: [name, proficiencyRank]
    lores: [string, number][];
    
    // Equipment
    equipmentContainers: Record<string, {
      containerName: string;
      bagOfHolding: boolean;
      backpack: boolean;
    }>;
    equipment: [string, number, string, string?][];  // [name, qty, containerOrStatus, status?]
    
    // Weapons
    weapons: {
      name: string;
      qty: number;
      prof: string;       // 'simple' | 'martial' | 'advanced' | 'unarmed'
      die: string;        // 'd4' | 'd6' | 'd8' | 'd10' | 'd12'
      pot: number;        // potency rune +1/+2/+3
      str: string;        // striking rune
      mat: string | null; // material
      display: string;
      runes: string[];
      damageType: string; // 'B' | 'P' | 'S'
      attack: number;     // total attack bonus
      damageBonus: number;
      extraDamage: unknown[];
      increasedDice: boolean;
    }[];
    
    // Armor
    armor: {
      name: string;
      qty: number;
      prof: string;
      pot: number;
      res: string;
      mat: string | null;
      display: string;
      worn: boolean;
      runes: string[];
    }[];
    
    // Money
    money: {
      cp: number;
      sp: number;
      gp: number;
      pp: number;
    };
    
    // Spellcasting
    spellCasters: unknown[];
    focusPoints: number;
    focus: Record<string, Record<string, {
      abilityBonus: number;
      proficiency: number;
      itemBonus: number;
      focusCantrips: string[];
      focusSpells: string[];
    }>>;
    
    // AC (pre-calculated)
    acTotal: {
      acProfBonus: number;
      acAbilityBonus: number;
      acItemBonus: number;
      acTotal: number;
      shieldBonus: number | null;
    };
    
    // Companions
    pets: unknown[];
    familiars: unknown[];
  };
}
```

### Current Combat-Sim PF2 Types
Il simulatore ha già tipi PF2 definiti in `shared/rulesets/pf2/types.ts`:
- `Abilities` - 6 attributi base
- `Proficiency` - untrained/trained/expert/master/legendary
- `PF2Weapon` - armi con traits
- `PF2Armor` - armature
- `PF2CombatantState` - stato combattimento (extends BaseCombatantState)

### Mapping Required
| Pathbuilder | Combat-Sim |
|-------------|------------|
| `abilities.str/dex/...` | `Abilities.strength/dexterity/...` |
| `proficiencies.X` (0/2/4/6/8) | `Proficiency` enum |
| `weapons[]` | `PF2Weapon[]` |
| `armor[]` | `PF2Armor[]` |
| `attributes.speed` | `PF2DerivedStats.speed` |
| Calcolo HP da attributes | `PF2DerivedStats.hitPoints` |
| `acTotal.acTotal` | `PF2DerivedStats.armorClass` |
| `proficiencies.fortitude/reflex/will` | `PF2DerivedStats.fortitudeSave/...` |

## User Decisions (confirmed)

### Metodo Import
- [x] Character ID (API fetch da pathbuilder2e.com)
- [x] File JSON Upload (upload manuale)

### Posizione UI
- Nel CharacterEditor PF2 esistente (tab/sezione dedicata)

### Scope Import
- [x] Stats base (Abilities, HP, AC, saves, speed)
- [x] Armi (weapons con dadi, bonus, traits)
- [x] Armatura (armor equipaggiata)
- [x] Skills/Proficiencies (tutte le skill)
- [x] Feats/Specials (nomi, no meccaniche complete)
- [x] Spellcasting (focus spells, spell slots)

### UX Decisions
- Character ID: campo input CON istruzioni inline su dove trovare l'ID
- Preview: SÌ, mostrare preview/riassunto prima di confermare import
- Campi non supportati: mostrare WARNING con lista di cosa non importato
- Comportamento import: CREA NUOVO personaggio (non sovrascrive editor)
- Error handling: errori mostrati INLINE nell'UI di import

## Scope Boundaries

### INCLUDE
- Import da API Pathbuilder (character ID)
- Import da file JSON
- UI integrata nel PF2CharacterEditor
- Preview del personaggio prima dell'import
- Mapping completo: abilities, HP, AC, saves, speed, weapons, armor, skills, feats, spells
- Warning per campi non supportati

### EXCLUDE
- Pets/Familiars (complessità elevata, fuori scope iniziale)
- Formulas/Crafting
- Inventory completo (solo armi/armature equipped)
- Meccaniche complete dei feats (solo nomi/descrizioni)

## Technical Decisions
- API endpoint: `https://pathbuilder2e.com/json.php?id={id}`
- Proficiency mapping: 0→untrained, 2→trained, 4→expert, 6→master, 8→legendary
- HP calculation: (ancestryhp + classhp) + (level * (classhp + CON_mod)) + bonushp + (level * bonushpPerLevel)
- Damage type mapping: 'B'→bludgeoning, 'P'→piercing, 'S'→slashing
