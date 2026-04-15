#!/usr/bin/env python3
"""
OPTIMA Desktop — Avatar Converter
Converts Sophia FBX → GLB using Blender's Python API

Usage:
  ./convert-avatar.py --input /path/to/rp_sophia_animated_003_idling.fbx --output assets/sophia.glb

Requirements:
  Blender 3+ installed at /Applications/Blender.app
"""

import argparse
import os
import sys
import subprocess
import tempfile

# Path to Blender's bundled Python
BLENDER_PYTHONS = [
    "/Applications/Blender.app/Contents/Resources/4.1/python/bin/python3.11",
    "/Applications/Blender.app/Contents/Resources/4.0/python/bin/python3.10",
    "/Applications/Blender.app/Contents/Resources/3.6/python/bin/python3.10",
    "/Applications/Blender.app/Contents/Resources/3.5/python/bin/python3.10",
    "/Applications/Blender.app/Contents/Resources/python/bin/python3.9",
]

def find_blender_python():
    for p in BLENDER_PYTHONS:
        if os.path.exists(p):
            return p
    return None


def convert_fbx_to_glb(input_path, output_path, blender_python):
    """Run Blender in background mode to convert FBX → GLB"""

    script = f"""
import bpy
import sys

# Clear existing scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Import FBX
bpy.ops.import_scene.fbx(
    filepath="{input_path}",
    use_preset_armors=True,
    ignore_leaf_bones=False,
    force_connect_children=True,
)

# Find root object (the armature or first mesh)
imported = bpy.context.selected_objects
print(f"Imported {{len(imported)}} objects")

# Select all
bpy.ops.object.select_all(action='SELECT')

# Export as GLB
bpy.ops.export_scene.gltf(
    filepath="{output_path}",
    export_format='GLB',
    export_materials='EXPORT',
)

print(f"Exported to {{'{output_path}'}}")
"""

    # Write script to temp file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(script)
        script_path = f.name

    try:
        blender_app = "/Applications/Blender.app/Contents/MacOS/Blender"
        if not os.path.exists(blender_app):
            print(f"ERROR: Blender app not found at {blender_app}")
            return False

        # Run Blender in background mode (--background) with Python script
        result = subprocess.run(
            [
                blender_app,
                "--background",
                "--python", script_path,
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )

        print("STDOUT:", result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)

        if result.returncode == 0 and os.path.exists(output_path):
            size = os.path.getsize(output_path)
            print(f"✅ Conversion successful! Output: {output_path} ({size / 1024 / 1024:.1f} MB)")
            return True
        else:
            print(f"❌ Conversion failed (exit code: {result.returncode})")
            return False

    finally:
        os.unlink(script_path)


def check_fbx_info(input_path):
    """Quick check of FBX file — number of meshes, animations, bones"""

    blender_python = find_blender_python()
    if not blender_python:
        print("⚠️ Blender not found — cannot inspect FBX")
        return

    script = f"""
import bpy

bpy.ops.import_scene.fbx(filepath="{input_path}", use_preset_armors=True)

objects = bpy.context.selected_objects
meshes = [o for o in objects if o.type == 'MESH']
armatures = [o for o in objects if o.type == 'ARMATURE']

print(f"Objects: {{len(objects)}}")
print(f"Meshes: {{len(meshes)}}")
print(f"Armatures: {{len(armatures)}}")

for obj in meshes:
    poly_count = len(obj.data.polygons)
    vert_count = len(obj.data.vertices)
    print(f"  Mesh: {{obj.name}} — {{poly_count}} polys, {{vert_count}} verts")

for arm in armatures:
    bones = arm.data.bones
    print(f"  Armature: {{arm.name}} — {{len(bones)}} bones")

# Check animations
action = bpy.data.actions
print(f"Actions: {{len(action)}}")
for a in action:
    print(f"  {{a.name}}")
"""

    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(script)
        script_path = f.name

    try:
        blender_app = "/Applications/Blender.app/Contents/MacOS/Blender"
        result = subprocess.run(
            [blender_app, "--background", "--python", script_path],
            capture_output=True,
            text=True,
            timeout=60,
        )
        print(result.stdout)
    finally:
        os.unlink(script_path)


def main():
    parser = argparse.ArgumentParser(description='Convert Sophia FBX to GLB for OPTIMA')
    parser.add_argument('--input', '-i', required=True, help='Input FBX path')
    parser.add_argument('--output', '-o', required=True, help='Output GLB path')
    parser.add_argument('--inspect', action='store_true', help='Inspect FBX only, no conversion')

    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"ERROR: Input file not found: {args.input}")
        sys.exit(1)

    # Make paths absolute
    input_path = os.path.abspath(args.input)
    output_path = os.path.abspath(args.output)

    # Ensure output dir exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    if args.inspect:
        print(f"Inspecting: {input_path}")
        check_fbx_info(input_path)
    else:
        blender_python = find_blender_python()
        if not blender_python:
            print("ERROR: Blender not found. Please install from https://blender.org")
            sys.exit(1)

        print(f"Converting: {input_path}")
        print(f"       →: {output_path}")
        success = convert_fbx_to_glb(input_path, output_path, blender_python)
        sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
