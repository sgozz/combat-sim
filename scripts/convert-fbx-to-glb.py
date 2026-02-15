"""
Batch convert FBX files to GLB using Blender.
Usage: blender --background --python convert-fbx-to-glb.py -- <input_dir> <output_dir>
"""
import bpy
import sys
import os
from pathlib import Path


def convert_fbx_to_glb(fbx_path: str, glb_path: str) -> bool:
    """Convert a single FBX file to GLB."""
    # Clear the scene
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Import FBX
    try:
        bpy.ops.import_scene.fbx(filepath=fbx_path)
    except Exception as e:
        print(f"  ERROR importing {fbx_path}: {e}")
        return False

    # Check what we got
    objects = [obj for obj in bpy.context.scene.objects]
    meshes = [obj for obj in objects if obj.type == 'MESH']
    armatures = [obj for obj in objects if obj.type == 'ARMATURE']

    print(f"  Found: {len(meshes)} meshes, {len(armatures)} armatures")

    # List animations if any
    for action in bpy.data.actions:
        frame_range = action.frame_range
        print(f"  Animation: '{action.name}' ({int(frame_range[1] - frame_range[0])} frames)")

    # Export as GLB
    try:
        bpy.ops.export_scene.gltf(
            filepath=glb_path,
            export_format='GLB',
            export_animations=True,
            export_skins=True,
            export_morph=True,
            export_lights=False,
            export_cameras=False,
            export_apply=False,  # Don't apply modifiers (preserve armature)
        )
        return True
    except Exception as e:
        print(f"  ERROR exporting {glb_path}: {e}")
        return False


def main():
    # Get arguments after "--"
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        print("Usage: blender --background --python convert-fbx-to-glb.py -- <input_dir> <output_dir>")
        sys.exit(1)

    if len(argv) < 2:
        print("Need input_dir and output_dir")
        sys.exit(1)

    input_dir = Path(argv[0])
    output_dir = Path(argv[1])
    output_dir.mkdir(parents=True, exist_ok=True)

    # Find all FBX files (skip collision meshes)
    fbx_files = []
    for fbx_path in sorted(input_dir.rglob("*.fbx")):
        if "Collision" in str(fbx_path):
            continue
        fbx_files.append(fbx_path)

    print(f"\nFound {len(fbx_files)} FBX files to convert\n")

    converted = 0
    failed = 0

    for fbx_path in fbx_files:
        name = fbx_path.stem
        glb_path = str(output_dir / f"{name}.glb")

        print(f"Converting: {name}")
        if convert_fbx_to_glb(str(fbx_path), glb_path):
            size_kb = os.path.getsize(glb_path) / 1024
            print(f"  OK -> {glb_path} ({size_kb:.0f} KB)")
            converted += 1
        else:
            failed += 1

    print(f"\nDone: {converted} converted, {failed} failed")


if __name__ == "__main__":
    main()
