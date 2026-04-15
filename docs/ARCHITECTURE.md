# OPTIMA Desktop — Architecture

## Overview

OPTIMA is an Electron-based macOS desktop application that renders a 3D avatar (Sophia) as an always-on companion. It captures the screen for visual context, transcribes voice input, generates AI responses, and speaks them back with synchronized avatar animation.

## Process Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    macOS Process                         │
│                                                          │
│  ┌─────────────────┐     ┌────────────────────────────┐ │
│  │  Main Process   │     │    Renderer Process        │ │
│  │  (main.js)      │     │    (renderer/)             │ │
│  │                 │     │                            │ │
│  │  • Tray icon    │◄────│  • Three.js (WebGL)       │ │
│  │  • Global       │ IPC │    • Avatar rendering      │ │
│  │    shortcuts    │     │    • Voice pipeline        │ │
│  │  • Screen       │     │    • UI overlay            │ │
│  │    capture      │     │                            │ │
│  │  • Window mgmt  │     │                            │ │
│  │  • App lifecycle│     │                            │ │
│  └────────┬────────┘     └────────────┬───────────────┘ │
│           │                            │                  │
│           │   contextBridge            │                  │
│           │◄──────────────────────────►│                  │
│           │   (preload.js)             │                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
         │
         │ HTTPS / local IPC
         ▼
┌──────────────────┐
│   OpenClaw       │
│   Gateway        │
│ (localhost:18789)│
└──────────────────┘
```

## IPC Channels

| Channel | Direction | Payload | Description |
|---------|-----------|---------|-------------|
| `screen:capture` | renderer→main | — | Returns base64 PNG of primary screen |
| `voice:ptt-start` | main→renderer | — | Global hotkey triggered |
| `voice:ptt-end` | main→renderer | — | PTT hotkey released |
| `avatar:toggle` | main→renderer | — | Toggle avatar visibility |
| `navigate:settings` | main→renderer | — | Open settings panel |
| `window:hide` | renderer→main | — | Hide window |
| `openclaw:handoff` | renderer→main | `{context, transcript}` | Delegate to OpenClaw |

## Avatar Rendering Pipeline

```
┌─────────────┐    ┌──────────────────┐    ┌────────────┐
│ Sophia GLB   │───►│ Three.js Scene   │───►│ WebGL      │
│ (pre-converted│    │ • GLTFLoader    │    │ Canvas     │
│  from FBX)   │    │ • AnimationMixer│    │ 360×420px  │
│              │    │ • Skinned mesh   │    │            │
└─────────────┘    │ • Bone cache     │    └────────────┘
                   └──────────────────┘
```

## Voice Pipeline

```
Microphone (MediaRecorder API)
    │
    ▼
Audio/WebM chunks ──► transcription (ElevenLabs Scribe)
    │
    ▼
Transcript text
    │
    ├─► OpenClaw handoff check
    │   └─► screen capture + transcript → OpenClaw gateway
    │
    └─► AI response
        │
        ▼
Text ──► ElevenLabs TTS ──► MP3 audio ──► HTML5 Audio element
    │
    └─► Avatar animation trigger (talking state)
```

## Window Configuration

The avatar window is:
- **Frameless** — no title bar, rounded corners
- **Transparent** — clear background, alpha channel enabled
- **Always on top** — floats above all other windows
- **Movable** — drag anywhere on screen
- **Skip taskbar** — hidden from Dock (tray icon only)
- **Non-resizable** — fixed 360×420px

Position: bottom-right, 20px from edges, 80px above Dock.

## State Machine

```
       ┌──────────────────────────────────┐
       │                                  │
       ▼                                  │
    [idle] ◄──────────────────────────[idle]
       │                                  ▲
       │ startPTT()                       │
       ▼                                  │
 [listening] ─── audio ready ──► [thinking]
       │                                  │
       │ response ready                   │
       ▼                                  │
    [talking] ─── audio ends ─────────────┘
```

## File Structure

```
src/
├── main/
│   ├── main.js      # BrowserWindow, Tray, global shortcuts, IPC
│   ├── ipc.js       # (planned) extracted IPC handlers
│   └── shortcuts.js # (planned) shortcut registration
├── preload.js       # contextBridge API exposure
└── renderer/
    ├── index.html   # UI shell + Three.js canvas
    ├── app.js       # Main renderer logic
    ├── avatar/      # (planned) AvatarRenderer class
    ├── voice/       # (planned) STT/TTS modules
    ├── screen/      # (planned) ScreenCapture class
    └── styles/
        └── app.css  # Dark theme, CSS variables
```

## Security Model

- `contextIsolation: true` — renderer can't access Node.js
- `nodeIntegration: false` — no require() in renderer
- `preload.js` exposes only whitelisted IPC channels
- Screen capture requires user-granted Screen Recording permission
- Microphone requires user-granted Microphone permission
- API keys stored in `localStorage` (not ideal — future: electron-store with encryption)

## Permissions Required (macOS)

1. **Microphone** — for voice input
2. **Screen Recording** — for screen capture (`desktopCapturer`)
3. **Accessibility** — optional, for advanced global shortcuts

Prompted automatically by macOS on first use of each feature.
