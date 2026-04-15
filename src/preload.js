/**
 * OPTIMA Desktop — Preload Script
 * Exposes safe IPC bridge to renderer
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose a limited API to the renderer process
contextBridge.exposeInMainWorld('optima', {
  // Screen capture
  captureScreen: () => ipcRenderer.invoke('screen:capture'),

  // Window control
  hideWindow: () => ipcRenderer.send('window:hide'),
  toggleVisibility: () => ipcRenderer.send('window:toggle-visibility'),

  // Voice events
  onPttStart: (cb) => ipcRenderer.on('voice:ptt-start', cb),
  onPttEnd: (cb) => ipcRenderer.on('voice:ptt-end', cb),
  voiceSessionStart: () => ipcRenderer.send('voice:session-start'),
  voiceSessionEnd: () => ipcRenderer.send('voice:session-end'),

  // Avatar
  onAvatarToggle: (cb) => ipcRenderer.on('avatar:toggle', cb),
  setAvatarState: (state) => ipcRenderer.send('avatar:set-state', state),

  // OpenClaw handoff
  openclawHandoff: (context) => ipcRenderer.invoke('openclaw:handoff', context),

  // App info
  getAppInfo: () => ipcRenderer.invoke('app:info'),

  // Navigation events from tray
  onNavigate: (cb) => ipcRenderer.on('navigate:settings', cb),

  // Platform info
  platform: process.platform,
});
