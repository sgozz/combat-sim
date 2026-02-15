"""
Retarget UAL1 animations onto Synty Bean character by renaming bone channels.
Usage: blender --background --python retarget-anims-to-synty.py
"""
import bpy
import os

# Bone name mapping: UAL1 (Quaternius) -> Synty Bean
BONE_MAP = {
    'root': 'Root',
    'pelvis': 'Hips',
    'spine_01': 'Spine_01',
    'spine_02': 'Spine_02',
    'spine_03': 'Spine_03',
    'neck_01': 'Neck',
    'Head': 'Head',
    'clavicle_l': 'Clavicle_L',
    'upperarm_l': 'Shoulder_L',
    'lowerarm_l': 'Elbow_L',
    'hand_l': 'Hand_L',
    'thumb_01_l': 'Thumb_01_L',
    'thumb_02_l': 'Thumb_02_L',
    'thumb_03_l': 'Thumb_03_L',
    'index_01_l': 'IndexFinger_01_L',
    'index_02_l': 'IndexFinger_02_L',
    'index_03_l': 'IndexFinger_03_L',
    'middle_01_l': 'Finger_01_L',
    'middle_02_l': 'Finger_02_L',
    'middle_03_l': 'Finger_03_L',
    'clavicle_r': 'Clavicle_R',
    'upperarm_r': 'Shoulder_R',
    'lowerarm_r': 'Elbow_R',
    'hand_r': 'Hand_R',
    'thumb_01_r': 'Thumb_01_R',
    'thumb_02_r': 'Thumb_02_R',
    'thumb_03_r': 'Thumb_03_R',
    'index_01_r': 'IndexFinger_01_R',
    'index_02_r': 'IndexFinger_02_R',
    'index_03_r': 'IndexFinger_03_R',
    'middle_01_r': 'Finger_01_R',
    'middle_02_r': 'Finger_02_R',
    'middle_03_r': 'Finger_03_R',
    'thigh_l': 'UpperLeg_L',
    'calf_l': 'LowerLeg_L',
    'foot_l': 'Ankle_L',
    'ball_l': 'Ball_L',
    'thigh_r': 'UpperLeg_R',
    'calf_r': 'LowerLeg_R',
    'foot_r': 'Ankle_R',
    'ball_r': 'Ball_R',
}

# Which animations to transfer (UAL1 action name suffix -> clean name for game)
ANIMATIONS_TO_TRANSFER = {
    'Idle_Loop_Armature': 'Idle_Loop',
    'Walk_Loop_Armature': 'Walk_Loop',
    'Sprint_Loop_Armature': 'Sprint_Loop',
    'Death01_Armature': 'Death01',
    'Roll_Armature': 'Roll',
    'Sword_Attack_Armature': 'Sword_Attack',
    'Hit_Chest_Armature': 'Hit_Chest',
    'Punch_Cross_Armature': 'Punch_Cross',
    'Crouch_Idle_Loop_Armature': 'Crouch_Idle_Loop',
    'Spell_Simple_Shoot_Armature': 'Spell_Simple_Shoot',
}

SYNTY_GLB = '/home/fabio/dev/combat-sim/public/models/synty-starter/Characters.glb'
UAL1_GLB = '/home/fabio/dev/combat-sim/public/models/quaternius/UAL1_Standard.glb'
OUTPUT_MALE = '/home/fabio/dev/combat-sim/public/models/synty-starter/SyntyBean_Male.glb'
OUTPUT_FEMALE = '/home/fabio/dev/combat-sim/public/models/synty-starter/SyntyBean_Female.glb'


def remap_action(source_action, new_name):
    """Clone an action and remap bone names from UAL1 to Synty."""
    new_action = source_action.copy()
    new_action.name = new_name

    remapped_count = 0
    for fcurve in new_action.fcurves:
        dp = fcurve.data_path
        for ual1_bone, synty_bone in BONE_MAP.items():
            old_ref = f'pose.bones["{ual1_bone}"]'
            new_ref = f'pose.bones["{synty_bone}"]'
            if old_ref in dp:
                fcurve.data_path = dp.replace(old_ref, new_ref)
                remapped_count += 1
                break

    return new_action


def export_glb(armature, mesh, actions, output_path):
    """Export selected objects with NLA animations to GLB."""
    # Setup NLA
    if not armature.animation_data:
        armature.animation_data_create()

    # Clear existing NLA tracks
    for track in list(armature.animation_data.nla_tracks):
        armature.animation_data.nla_tracks.remove(track)

    # Set first action as active
    if actions:
        armature.animation_data.action = actions[0]

    # Create NLA tracks for all actions
    for action in actions:
        track = armature.animation_data.nla_tracks.new()
        track.name = action.name
        strip = track.strips.new(action.name, int(action.frame_range[0]), action)
        strip.name = action.name

    # Deselect all, then select only what we want
    for obj in bpy.context.scene.objects:
        obj.select_set(False)

    armature.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = armature

    # Export
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=True,
        export_animations=True,
        export_skins=True,
        export_morph=True,
        export_lights=False,
        export_cameras=False,
        export_apply=False,
        export_nla_strips=True,
        export_nla_strips_merged_animation_name='',
    )

    size_kb = os.path.getsize(output_path) / 1024
    print(f"  Exported: {output_path} ({size_kb:.0f} KB)")


def main():
    # Start clean
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Step 1: Import UAL1 to get animations
    print("\n=== Step 1: Load UAL1 animations ===")
    bpy.ops.import_scene.gltf(filepath=UAL1_GLB)

    # Remap actions
    print("\n=== Step 2: Remap animations ===")
    remapped_actions = []
    for action in list(bpy.data.actions):
        if action.name in ANIMATIONS_TO_TRANSFER:
            clean_name = ANIMATIONS_TO_TRANSFER[action.name]
            new_action = remap_action(action, clean_name)
            remapped_actions.append(new_action)
            print(f"  {action.name} -> {clean_name}")

    print(f"  Total: {len(remapped_actions)} animations remapped")

    # Remove UAL1 objects from scene (keep actions in bpy.data)
    for obj in list(bpy.context.scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    # Step 3: Import Synty characters into same scene (actions survive!)
    print("\n=== Step 3: Load Synty characters ===")
    bpy.ops.import_scene.gltf(filepath=SYNTY_GLB)

    # Verify actions survived
    action_names = [a.name for a in bpy.data.actions if a.name in ANIMATIONS_TO_TRANSFER.values()]
    print(f"  Actions in bpy.data: {action_names}")

    # Re-fetch remapped actions from bpy.data (same objects, still alive)
    final_actions = [a for a in bpy.data.actions if a.name in ANIMATIONS_TO_TRANSFER.values()]

    # Find Synty objects
    synty_armature = None
    synty_male = None
    synty_female = None

    for obj in bpy.context.scene.objects:
        if obj.type == 'ARMATURE':
            synty_armature = obj
        elif obj.type == 'MESH':
            if 'Male' in obj.name:
                synty_male = obj
            elif 'Female' in obj.name:
                synty_female = obj

    if not synty_armature:
        print("ERROR: No armature found!")
        return

    print(f"  Armature: {synty_armature.name} ({len(synty_armature.data.bones)} bones)")
    print(f"  Male: {synty_male.name if synty_male else 'NOT FOUND'}")
    print(f"  Female: {synty_female.name if synty_female else 'NOT FOUND'}")

    # Remove extras (Light, Camera, Cube, Icosphere)
    for obj in list(bpy.context.scene.objects):
        if obj.type in ('LIGHT', 'CAMERA'):
            bpy.data.objects.remove(obj, do_unlink=True)
        elif obj.type == 'MESH' and obj not in (synty_male, synty_female):
            bpy.data.objects.remove(obj, do_unlink=True)

    # Export Male
    print("\n=== Step 4: Export Male ===")
    if synty_male and synty_female:
        # Hide female for male export
        synty_female.hide_set(True)
        synty_female.select_set(False)
        export_glb(synty_armature, synty_male, final_actions, OUTPUT_MALE)
        synty_female.hide_set(False)

    # Export Female
    print("\n=== Step 5: Export Female ===")
    if synty_female and synty_male:
        synty_male.hide_set(True)
        synty_male.select_set(False)
        export_glb(synty_armature, synty_female, final_actions, OUTPUT_FEMALE)
        synty_male.hide_set(False)

    print("\n=== ALL DONE ===")


if __name__ == '__main__':
    main()
