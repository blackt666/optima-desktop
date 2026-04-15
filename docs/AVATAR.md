# Avatar — Sophia Character Guide

## Source Files

Located in `/Users/atillacaliskan/Downloads/sophia.fbx/`:

| File | Size | Description |
|------|------|-------------|
| `rp_sophia_animated_003_idling.fbx` | 10MB | **Main file** — rigged, animated, ready to use |
| `rp_sophia_animated_003_idling_ue4.fbx` | 3MB | Unreal Engine 4 optimized variant |
| `rp_sophia_animated_003_idling_u3d.fbx` | 2.7MB | Universal 3D format variant |
| `rp_sophia_animated_003_idling_A.jpg` | 47KB | Texture atlas preview |

## Quick Stats (from file header)

- **Format:** Kaydara FBX Binary, version 7300 (FBX 2015.1)
- **Creator:** FBX SDK/FBX Plugins v2015.1
- **Type:** Character mesh with skeleton animation

## Conversion Pipeline

```
Sophia FBX (10MB)
      │
      ▼
Blender (import fbx)
  • Apply scale/rotation
  • Bake transforms
  • Verify rig (ARMATURE + MESH)
      │
      ▼
Sophia GLB (~3-5MB)
  • Draco compression (optional)
  • Strip unused materials
  • Embed textures (base color)
      │
      ▼
assets/sophia.glb
      │
      ▼
Three.js GLTFLoader → <scene>
```

## Conversion Command

```bash
./scripts/convert-avatar.py \
  --input "/Users/atillacaliskan/Downloads/sophia.fbx/rp_sophia_animated_003_idling.fbx" \
  --output assets/sophia.glb
```

## Blendshape / Lip-Sync Strategy

**Problem:** Sophia has **no facial blendshapes** in the Renderpeople FBX.

**Solution 1 — Procedural Head Animation (Recommended for v1):**
- Use head bone rotation to create "listening" idle
- Add subtle body sway during "talking" state
- Eye tracking: make eyes follow cursor direction
- No actual lip-sync — rely on audio + body language

**Solution 2 — Pre-Baked Visemes (Future):**
1. In Blender, sculpt 8 viseme shapes (A, E, I, O, U, etc.)
2. Export as separate morph targets or blend to existing mesh
3. Drive with Web Audio API analyser → viseme weights
4. Requires significant Blender work (2-4 hours)

**Solution 3 — Ready Player Me / VRoid Hub:**
- Download a VRM 1.0 avatar with full blendshapes
- Use `@pixiv/three-vrm` for WebGL rendering
- Better lip-sync out of the box
- Recommended if you want a more expressive avatar

## Animation States

| State | Trigger | Animation |
|-------|---------|-----------|
| `idle` | Default | Loop Sophia's idle animation |
| `listening` | Mic active | Subtle head tilt, alert posture |
| `thinking` | Processing | Gentle sway, looking slightly up |
| `talking` | TTS playing | Idle animation + body sway |
| `hidden` | Toggle | Hide entire scene |

## Bone Reference

Key bones to animate programmatically (by name, exact names TBD after Blender import):

```
Root
└── Hips
    ├── Spine
    │   ├── Chest
    │   │   ├── Neck
    │   │   │   └── Head ← animate for head movements
    │   │   ├── Clavicle.L → Armature.L
    │   │   └── Clavicle.R → Armature.R
    ├── Thigh.L → Shin.L → Foot.L
    └── Thigh.R → Shin.R → Foot.R
```

## Rendering Notes

- **Scale:** 1 unit ≈ 1 meter (human scale)
- **Recommended camera:** PerspectiveCamera, FOV 45°, positioned at `(0, 1.2, 3.5)`
- **Lighting:** 3-point setup (key, fill, rim) — see `app.js`
- **Transparent background:** `renderer.setClearAlpha(0)` + `scene.background = null`
- **Tone mapping:** `ACESFilmicToneMapping` for natural skin tones

## Troubleshooting

**Avatar appears black / no lighting:**
→ Check that lights are added to `scene` and `renderer.outputEncoding = THREE.sRGBEncoding`

**Avatar is too small / huge:**
→ Adjust `avatar.scale.set()` and `camera.position.z`

**Animation not playing:**
→ Ensure `AnimationMixer.update(delta)` is called in render loop
→ Check that `currentAction.play()` was called

**GLB fails to load:**
→ The GLB file may not exist yet — run `convert-avatar.py` first
→ Check browser console for 404 or parse errors

## Fallback: Placeholder Avatar

If the Sophia GLB fails to load, the app automatically creates a geometric placeholder:
- Purple (OPTIMA accent color) capsule body + sphere head
- Glowing green eyes
- Simple bob animation

This ensures the app is always runnable, even without the FBX conversion step.
