# OPTIMA Desktop — macOS AI Assistant with 3D Avatar

> 🤖 Your always-on desktop AI companion — built on OPTIMAIZER technology

**OPTIMA** is a macOS desktop AI assistant featuring a 3D avatar ("Sophia") that lives in the corner of your screen. It sees your screen, hears you, speaks back — and hands off complex tasks to the OpenClaw agent.

![OPTIMA](docs/banner.png)

## ✨ Features

- **Always-on 3D Avatar** — Sophia sits in the corner of your screen, responding with idle/talk animations
- **Screen Context** — Captures what's on-screen for context-aware AI responses
- **Voice I/O** — Push-to-talk or always-listening via ElevenLabs STT/TTS
- **OpenClaw Handoff** — "Nimm OpenClaw..." delegates complex tasks to the OpenClaw agent
- **System Tray** — Runs quietly in the menu bar, no dock icon clutter
- **Global Hotkey** — Push-to-talk (configurable, default: ⌘⇧O)
- **Dark Theme** — Matches OPTIMAIZER's dark aesthetic

## 🏗️ Architecture

```
optima-desktop/
├── src/
│   ├── main/               # Electron main process
│   │   ├── main.js          # Entry point, window management, tray
│   │   ├── ipc.js           # IPC handlers
│   │   └── shortcuts.js     # Global hotkey registration
│   ├── renderer/            # Electron renderer (Three.js UI)
│   │   ├── index.html       # Main window
│   │   ├── app.js           # App bootstrap
│   │   ├── avatar/          # Three.js Sophia renderer
│   │   │   ├── AvatarRenderer.js
│   │   │   ├── LipSync.js
│   │   │   └── animations.js
│   │   ├── voice/           # STT/TTS modules
│   │   │   ├── stt.js       # ElevenLabs/Whisper STT
│   │   │   └── tts.js       # ElevenLabs TTS
│   │   ├── screen/          # Screen capture
│   │   │   └── capture.js   # macOS screen capture via desktopCapturer
│   │   ├── openclaw/        # OpenClaw integration
│   │   │   └── handoff.js   # Session handoff protocol
│   │   └── styles/
│   │       └── app.css      # Dark theme styles
│   └── preload.js           # Preload script (IPC bridge)
├── assets/
│   ├── sophia.glb           # Converted avatar (from FBX)
│   └── icons/               # Tray + app icons
├── scripts/
│   ├── setup.sh             # Initial setup
│   ├── convert-avatar.py    # FBX → GLB via Blender
│   └── build-macos.sh       # Production build script
├── docs/
│   ├── ARCHITECTURE.md      # Deep dive
│   ├── AVATAR.md            # Avatar conversion guide
│   └── VOICE.md             # Voice pipeline docs
├── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- macOS 12+ (Apple Silicon preferred)
- Node.js 20+
- [Blender 3+](https://www.blender.org/) (for avatar conversion)
- ElevenLabs API key (for voice)

### Setup

```bash
# Clone & install
git clone https://github.com/blackt666/optima-desktop.git
cd optima-desktop
./scripts/setup.sh

# Configure
cp .env.example .env
# Edit .env with your API keys

# Run in dev mode
npm run dev
```

### Avatar Setup

The Sophia FBX files from Renderpeople need to be converted to GLB for Three.js:

```bash
# After installing Blender
./scripts/convert-avatar.py --input ../Downloads/sophia.fbx/rp_sophia_animated_003_idling.fbx --output assets/sophia.glb
```

## 🎭 Avatar

**Sophia** is a rigged, animated character from [Renderpeople](https://renderpeople.com/). Key stats:

| Attribute | Value |
|-----------|-------|
| Format | FBX (binary, v7.3) |
| Polygons | ~25K |
| Bones | Yes (Skeleton rig) |
| Animations | Idle loop, talk ready |
| Blendshapes | Not included (lip-sync via morph targets) |
| Textures | Diffuse + Normal + Specular |

### Lip-Sync Strategy

Since Sophia doesn't have facial blendshapes baked in, we use a **morph-target approach**:
1. Pre-compute 8-12 viseme shapes via Blender
2. Drive them procedurally based on TTS audio analysis
3. Blend between visemes at 30fps for smooth speech

If viseme creation is too complex, fall back to **head bob + body sway** during speech (simpler, still expressive).

## 🗣️ Voice Pipeline

```
Microphone → Whisper (local) or ElevenLabs STT → LLM → ElevenLabs TTS → Avatar Animation
```

### STT Options
- **Local**: Whisper via `whisper.cpp` or `transformers.js` — no API cost
- **Cloud**: ElevenLabs Speech-to-Text API — higher quality

### TTS Options
- **ElevenLabs** — primary, high quality, voice cloning available
- **Local fallback** — `say` command (macOS built-in) for simple responses

## 🔄 OpenClaw Handoff

When you say **"Nimm OpenClaw..."** (German) or **"Use OpenClaw..."** (English):

1. Current screen context + transcript sent to OpenClaw
2. OpenClaw agent takes over in its own session
3. Results streamed back to OPTIMA renderer
4. Avatar reacts to completion state

## ⌨️ Global Hotkeys

| Shortcut | Action |
|----------|--------|
| `⌘⇧O` | Push-to-talk (default) |
| `⌘⇧H` | Toggle avatar visibility |
| `⌘⇧Q` | Quit |

## 🔒 Security & Privacy

- Screen capture stays **local** — never sent to any server unless explicitly configured
- Voice data: ElevenLabs API only (encrypted in transit)
- OpenClaw handoff: local IPC or authenticated HTTPS to your OpenClaw gateway
- `.env` file **never committed** — contains API keys only

## 📦 Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Runtime | Electron 33+ |
| 3D Rendering | Three.js + WebGL |
| Avatar Format | GLB (GLTF binary) |
| Screen Capture | Electron `desktopCapturer` |
| Voice STT | ElevenLabs / Whisper.cpp |
| Voice TTS | ElevenLabs API |
| Styling | Vanilla CSS (dark theme) |
| Persistence | electron-store (JSON) |
| Build | electron-builder |
| Icons | SF Symbols + custom |

## ⚠️ Known Limitations

- Sophia FBX has **no facial blendshapes** — lip-sync is approximate
- Screen capture requires **Screen Recording permission** on macOS
- Always-on listening (vs push-to-talk) requires **Microphone permission**
- Avatar position only supports **bottom-right corner** in v1

## 📄 License

MIT — see [LICENSE](LICENSE)

---

Built with 🦾 by [OPTIMAIZER](https://optimaizer-saas.vercel.app)
