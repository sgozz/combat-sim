# Quaternius Universal Animation Library 2 - Setup Guide

## Overview
This directory contains models and animations from the **Quaternius Universal Animation Library 2**.
These are high-quality realistic humanoid animations (130+) that can be used alongside the classic fantasy models.

## Download

1. Visit: https://quaternius.itch.io/universal-animation-library-2
2. Click "Download Now" (free - name your own price)
3. Download the **Standard** version (GLB format)

## Installation

### Option 1: Manual Copy
Extract the downloaded zip and copy the GLB files to this directory:

```
public/models/quaternius/
├── humanoid_armed.glb      (for Warrior)
├── humanoid_stealth.glb    (for Rogue)
├── humanoid_mage.glb       (for Wizard/Mage)
├── humanoid_healer.glb     (for Cleric)
├── humanoid_archer.glb     (for Ranger)
└── humanoid_unarmed.glb    (for Monk)
```

### Option 2: Custom Models
You can also use your own GLB files with the same names, or edit `src/data/modelRegistry.ts` to point to different files.

## Supported Animations

The registry expects these animation names in the GLB files:

### Required (Basic)
- `Idle` - Standing idle
- `Walk` - Walking animation
- `Run` - Running animation
- `Death` - Death/fall animation
- `Jump` - Jump animation

### Combat Animations
- `Sword_Combo_1` - Sword attack (for warriors)
- `Dagger_Attack_1` - Dagger attack (for rogues)
- `Spell_Cast` - Spell casting (for mages)
- `Staff_Attack` - Staff attack (for clerics)
- `Bow_Shoot` - Bow shooting (for rangers)
- `Punch_Combo_1` - Unarmed attack (for monks)

### Alternative Names
If your GLB files use different animation names, update the `animations` map in `src/data/modelRegistry.ts`:

```typescript
animations: {
  idle: 'Your_Idle_Name',
  walk: 'Your_Walk_Name',
  run: 'Your_Run_Name',
  death: 'Your_Death_Name',
  jump: 'Your_Jump_Name',
  punch: 'Your_Attack_Name',
  working: 'Your_Combat_Idle_Name',
}
```

## Usage in Game

When creating a character, you can now choose between:

- **Classic** models: Fantasy RPG style (warrior, rogue, wizard, etc.)
- **Realistic** models: Quaternius humanoid animations

The choice is saved in the character sheet and will be used for all animations in combat.

## License

Quaternius assets are licensed under CC0 (Public Domain).
Free for personal, educational, and commercial use.

## Troubleshooting

### Models not appearing
- Ensure GLB files are in the correct directory
- Check browser console for 404 errors
- Verify animation names match the registry

### Animations not playing
- Open the GLB file in a viewer (e.g., https://gltf-viewer.donmccurdy.com/)
- Check the exact animation clip names
- Update `modelRegistry.ts` with the correct names

### Scale issues
- Adjust the `scale` value in `modelRegistry.ts` (default: 1.0)
- Try values between 0.5 and 2.0 depending on your model

## Support

For issues with the Quaternius assets:
- Website: https://quaternius.com
- Itch.io: https://quaternius.itch.io
- Discord: https://discord.gg/quaternius

For issues with this integration:
- Check the main project documentation
- Open an issue in the project repository
