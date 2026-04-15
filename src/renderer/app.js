/**
 * OPTIMA Desktop — Renderer Entry
 * Three.js avatar + voice + IPC integration
 */

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  avatarVisible: true,
  isListening: false,
  isSpeaking: false,
  isProcessing: false,
  avatarState: 'idle', // idle | listening | talking | thinking
};

// ─── Three.js Setup ───────────────────────────────────────────────────────────
let renderer, scene, camera, avatar, clock;
let mixer = null;
let currentAction = null;
let bones = {};
let lipSyncMixer = null;

async function initThree() {
  const canvas = document.getElementById('avatar-canvas');
  const container = document.getElementById('avatar-container');

  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(360, 420);
  renderer.shadowMap.enabled = false;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(45, 360 / 420, 0.1, 100);
  camera.position.set(0, 1.2, 3.5);
  camera.lookAt(0, 1.0, 0);

  clock = new THREE.Clock();

  // Lighting — subtle dark theme friendly
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xfff5e0, 1.2);
  key.position.set(2, 3, 2);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xc0d0ff, 0.4);
  fill.position.set(-2, 1, -1);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0x6c5ce7, 0.3);
  rim.position.set(0, 2, -3);
  scene.add(rim);

  // Load avatar
  await loadAvatar();

  // Start render loop
  animate();

  console.log('[OPTIMA] Three.js initialized');
}

async function loadAvatar() {
  try {
    // Try loading the Sophia GLB
    const glbUrl = getAvatarPath();
    const response = await fetch(glbUrl);
    if (!response.ok) {
      console.warn('[OPTIMA] No avatar GLB found — using placeholder');
      createPlaceholderAvatar();
      return;
    }
    const buffer = await response.arrayBuffer();
    const { GLTFLoader } = await importThreeGLTF();
    const loader = new GLTFLoader();
    const gltf = await new Promise((res, rej) => loader.load(glbUrl, res, undefined, rej));

    avatar = gltf.scene;
    avatar.scale.set(1, 1, 1);
    avatar.position.set(0, 0, 0);

    // Center the avatar
    const box = new THREE.Box3().setFromObject(avatar);
    const center = box.getCenter(new THREE.Vector3());
    avatar.position.x -= center.x;
    avatar.position.y -= box.min.y; // ground at y=0

    scene.add(avatar);

    // Cache bones by name
    avatar.traverse((node) => {
      if (node.isBone || node.name) {
        bones[node.name] = node;
      }
    });

    // Setup animations
    if (gltf.animations?.length > 0) {
      mixer = new THREE.AnimationMixer(avatar);
      const idleAnim = gltf.animations.find(a =>
        a.name.toLowerCase().includes('idle') || a.name.toLowerCase().includes('stand')
      ) || gltf.animations[0];

      if (idleAnim) {
        currentAction = mixer.clipAction(idleAnim);
        currentAction.play();
        console.log('[OPTIMA] Playing animation:', idleAnim.name);
      }
    }

    console.log('[OPTIMA] Avatar loaded:', avatar);
  } catch (err) {
    console.warn('[OPTIMA] Avatar load failed — using placeholder:', err.message);
    createPlaceholderAvatar();
  }
}

function createPlaceholderAvatar() {
  // Simple geometric placeholder (stylized robot head + body)
  const group = new THREE.Group();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x6c5ce7,
    metalness: 0.3,
    roughness: 0.6,
    emissive: 0x2d2d50,
  });

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 32), mat);
  head.position.y = 1.4;
  group.add(head);

  // Eyes
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 2 });
  const eyeGeo = new THREE.SphereGeometry(0.06, 16, 16);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.12, 1.45, 0.32);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.12, 1.45, 0.32);
  group.add(leftEye, rightEye);

  // Body
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.5, 8, 16), mat);
  body.position.y = 0.85;
  group.add(body);

  // Base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.15, 32), mat);
  base.position.y = 0.07;
  group.add(base);

  avatar = group;
  scene.add(avatar);
  bones = {};

  console.log('[OPTIMA] Placeholder avatar created');
}

function getAvatarPath() {
  // In dev: assets/sophia.glb, in prod: extraResources path
  const paths = [
    '../assets/sophia.glb',
    '../../assets/sophia.glb',
    '../../../assets/sophia.glb',
    './assets/sophia.glb',
    'optima-desktop/../../../assets/sophia.glb',
    'optima-desktop/../../assets/sophia.glb',
    '/Applications/OPTIMA.app/Contents/Resources/sophia.glb',
  ];
  // We'll try them sequentially in loadAvatar
  return paths[0];
}

// Dynamic import of Three.js addons (GLTFLoader)
async function importThreeGLTF() {
  // If THREE is loaded from CDN/global, use it
  if (window.THREE) {
    const THREE_GLB = window.THREE;
    // Load GLTFLoader via importScripts or from a known CDN path
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/three@0.134.0/examples/js/loaders/GLTFLoader.js';
      script.onload = () => resolve(window.THREE);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  // Fallback: use npm import if bundled
  return THREE;
}

// ─── Animation Loop ───────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (mixer) mixer.update(delta);
  if (avatar && state.isSpeaking) {
    // Subtle bob while speaking
    avatar.position.y = Math.sin(Date.now() * 0.005) * 0.02;
  } else if (avatar) {
    avatar.position.y = 0;
  }

  renderer.render(scene, camera);
}

// ─── Avatar State Machine ─────────────────────────────────────────────────────
function setAvatarState(newState) {
  state.avatarState = newState;
  window.optima?.setAvatarState(newState);

  switch (newState) {
    case 'idle':
      setStatus('idle', 'ready');
      hideSpeechBubble();
      if (currentAction) {
        // Ensure idle animation is playing
      }
      break;
    case 'listening':
      setStatus('listening', 'listening');
      break;
    case 'thinking':
      setStatus('processing', 'thinking');
      break;
    case 'talking':
      setStatus('speaking', 'speaking');
      break;
  }
}

// ─── Status Bar ──────────────────────────────────────────────────────────────
function setStatus(dotClass, text) {
  const dot = document.getElementById('status-dot');
  const label = document.getElementById('status-text');
  dot.className = dotClass;
  label.textContent = text;
}

// ─── Speech Bubble ────────────────────────────────────────────────────────────
function showSpeechBubble(text) {
  const bubble = document.getElementById('speech-bubble');
  const textEl = document.getElementById('speech-text');
  textEl.textContent = text;
  bubble.classList.remove('hidden');
  bubble.classList.add('visible');
}

function hideSpeechBubble() {
  const bubble = document.getElementById('speech-bubble');
  bubble.classList.remove('visible');
  bubble.classList.add('hidden');
}

// ─── Push-to-Talk ─────────────────────────────────────────────────────────────
let mediaRecorder = null;
let audioChunks = [];
let pttTimeout = null;

const pttBtn = document.getElementById('ptt-btn');
const pttIcon = document.getElementById('ptt-icon');
const pttLabel = document.getElementById('ptt-label');

pttBtn.addEventListener('mousedown', startPTT);
pttBtn.addEventListener('mouseup', endPTT);
pttBtn.addEventListener('mouseleave', endPTT);

// Touch support
pttBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startPTT(); });
pttBtn.addEventListener('touchend', (e) => { e.preventDefault(); endPTT(); });

async function startPTT() {
  if (state.isListening) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
    mediaRecorder.onstop = processAudio;
    mediaRecorder.start(100); // chunk every 100ms

    state.isListening = true;
    pttBtn.classList.add('active');
    pttIcon.textContent = '🔴';
    pttLabel.textContent = 'Listening...';
    setAvatarState('listening');
    window.optima?.voiceSessionStart();

    // Auto-stop after 15s
    pttTimeout = setTimeout(endPTT, 15000);
  } catch (err) {
    console.error('[OPTIMA] Microphone error:', err);
    pttLabel.textContent = 'Mic denied';
  }
}

async function endPTT() {
  if (!state.isListening) return;
  clearTimeout(pttTimeout);
  state.isListening = false;
  pttBtn.classList.remove('active');
  pttIcon.textContent = '🎙️';
  pttLabel.textContent = 'Hold to talk';

  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
  }
}

async function processAudio() {
  if (audioChunks.length === 0) return;

  const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
  const transcript = await transcribe(audioBlob);

  if (transcript && transcript.trim()) {
    showSpeechBubble(transcript);
    setAvatarState('thinking');

    const response = await getAIResponse(transcript);
    if (response) {
      setAvatarState('talking');
      showSpeechBubble(response.text);
      await speak(response.text, response.audioUrl);
    }
  }

  setAvatarState('idle');
  window.optima?.voiceSessionEnd();
}

// ─── Voice Pipeline ──────────────────────────────────────────────────────────
async function transcribe(blob) {
  // ElevenLabs STT
  const apiKey = localStorage.getItem('optima_elevenlabs_key');
  if (!apiKey) {
    console.warn('[OPTIMA] No ElevenLabs API key — skipping STT');
    return null;
  }

  try {
    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');
    formData.append('model_id', 'scribe_multilingual');

    const res = await fetch('https://api.elevenlabs.io/v1/scribe/scribe_multilingual', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: formData,
    });

    if (!res.ok) throw new Error(`STT error: ${res.status}`);
    const data = await res.json();
    return data.text || '';
  } catch (err) {
    console.error('[OPTIMA] STT failed:', err);
    return null;
  }
}

async function speak(text, audioUrl) {
  const apiKey = localStorage.getItem('optima_elevenlabs_key');
  const voiceId = localStorage.getItem('optima_voice_id') || 'rachel' ;

  if (!apiKey) {
    console.warn('[OPTIMA] No ElevenLabs API key — using macOS say');
    fallbackSpeak(text);
    return;
  }

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_flash_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
    });

    if (!res.ok) throw new Error(`TTS error: ${res.status}`);
    const audioBuffer = await res.arrayBuffer();
    const blob = new Blob([audioBuffer], { type: 'audio/mp3' });
    const url = URL.createObjectURL(blob);

    const audio = new Audio(url);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      setAvatarState('idle');
      hideSpeechBubble();
    };
    await audio.play();
  } catch (err) {
    console.error('[OPTIMA] TTS failed:', err);
    fallbackSpeak(text);
  }
}

function fallbackSpeak(text) {
  // macOS built-in `say` command via window.optima IPC (not directly available in renderer)
  // For now, just show the text and hide after a delay
  setTimeout(() => {
    setAvatarState('idle');
    hideSpeechBubble();
  }, text.length * 60);
}

async function getAIResponse(transcript) {
  // Check for OpenClaw handoff
  const openclawPatterns = [
    /nimm\s*openclaw/i,
    /use\s*openclaw/i,
    /take\s*over\s*openclaw/i,
    /delegiere\s*an\s*openclaw/i,
  ];

  if (openclawPatterns.some(p => p.test(transcript))) {
    setAvatarState('thinking');
    const screenCapture = await window.optima?.captureScreen();
    const result = await window.optima?.openclawHandoff({
      context: { screenCapture },
      transcript,
    });
    return {
      text: `OpenClaw task delegated. Result: ${result?.message || 'ok'}`,
    };
  }

  // Simple echo/placeholder — in production, connect to your LLM
  return {
    text: `I heard: "${transcript}". Full OpenClaw + LLM integration coming in Phase 5.`,
  };
}

// ─── IPC Events ───────────────────────────────────────────────────────────────
window.optima?.onPttStart(() => {
  if (!state.isListening) startPTT();
});

window.optima?.onAvatarToggle(() => {
  state.avatarVisible = !state.avatarVisible;
  const container = document.getElementById('avatar-container');
  container.style.opacity = state.avatarVisible ? '1' : '0';
  container.style.transition = 'opacity 0.3s ease';
});

window.optima?.onNavigate(() => {
  showSettings();
});

// ─── Settings Panel ──────────────────────────────────────────────────────────
const settingsPanel = document.getElementById('settings-panel');
const closeSettingsBtn = document.getElementById('close-settings');
const avatarVisibleToggle = document.getElementById('avatar-visible');
const alwaysListeningToggle = document.getElementById('always-listening');

closeSettingsBtn.addEventListener('click', hideSettings);

avatarVisibleToggle.addEventListener('change', (e) => {
  const container = document.getElementById('avatar-container');
  container.style.opacity = e.target.checked ? '1' : '0';
  state.avatarVisible = e.target.checked;
});

alwaysListeningToggle.addEventListener('change', async (e) => {
  if (e.target.checked) {
    // Request microphone and start always-listening mode
    startAlwaysListening();
  } else {
    stopAlwaysListening();
  }
});

// Load saved settings
function loadSettings() {
  const apiKey = localStorage.getItem('optima_elevenlabs_key') || '';
  const voiceId = localStorage.getItem('optima_voice_id') || 'rachel';
  document.getElementById('stt-provider').value =
    localStorage.getItem('optima_stt_provider') || 'elevenlabs';
  document.getElementById('tts-voice').value = voiceId;
  document.getElementById('avatar-visible').checked = state.avatarVisible;
}

// Settings persistence
document.getElementById('stt-provider')?.addEventListener('change', (e) => {
  localStorage.setItem('optima_stt_provider', e.target.value);
});

document.getElementById('tts-voice')?.addEventListener('change', (e) => {
  localStorage.setItem('optima_voice_id', e.target.value);
});

function showSettings() {
  settingsPanel.classList.remove('hidden');
  settingsPanel.classList.add('visible');
}

function hideSettings() {
  settingsPanel.classList.remove('visible');
  settingsPanel.classList.add('hidden');
}

// ─── Always Listening Mode ────────────────────────────────────────────────────
let alwaysListeningStream = null;
let alwaysListeningAnalyser = null;

async function startAlwaysListening() {
  try {
    alwaysListeningStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(alwaysListeningStream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    // Simple VAD: watch for volume spikes
    const data = new Uint8Array(analyser.frequencyBinCount);
    const check = () => {
      if (!alwaysListeningStream) return;
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      if (avg > 30 && !state.isListening) {
        startPTT();
      }
      requestAnimationFrame(check);
    };
    check();
  } catch (err) {
    console.error('[OPTIMA] Always listening failed:', err);
    alwaysListeningToggle.checked = false;
  }
}

function stopAlwaysListening() {
  if (alwaysListeningStream) {
    alwaysListeningStream.getTracks().forEach(t => t.stop());
    alwaysListeningStream = null;
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[OPTIMA] Renderer starting...');

  await initThree();
  loadSettings();
  setAvatarState('idle');

  // Check for API key
  const hasApiKey = localStorage.getItem('optima_elevenlabs_key');
  if (!hasApiKey) {
    // Show a subtle hint in status
    setStatus('idle', 'no API key');
    setTimeout(() => setStatus('idle', 'ready'), 3000);
  }

  // Load voice list from ElevenLabs
  loadVoiceList();

  console.log('[OPTIMA] Ready');
});

async function loadVoiceList() {
  const apiKey = localStorage.getItem('optima_elevenlabs_key');
  if (!apiKey) return;

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey },
    });
    if (!res.ok) return;
    const data = await res.json();
    const select = document.getElementById('tts-voice');
    select.innerHTML = '';
    data.voices?.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.voice_id;
      opt.textContent = `${v.name} (${v.language})`;
      select.appendChild(opt);
    });
    const saved = localStorage.getItem('optima_voice_id');
    if (saved) select.value = saved;
  } catch (err) {
    console.warn('[OPTIMA] Could not load voice list:', err);
  }
}
