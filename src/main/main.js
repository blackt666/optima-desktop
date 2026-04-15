/**
 * OPTIMA Desktop — Electron Main Process
 * Entry point: window management, tray, IPC, global shortcuts
 */

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  ipcMain,
  desktopCapturer,
  nativeImage,
  dialog,
  shell,
} = require('electron');
const path = require('path');
const fs = require('fs');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// ─── Config ──────────────────────────────────────────────────────────────────
const IS_DEV = process.argv.includes('--dev');
const WINDOW_WIDTH = 360;
const WINDOW_HEIGHT = 420;
const AVATAR_Y_OFFSET = 80; // px from bottom of screen

// ─── Globals ─────────────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let isQuitting = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getAssetPath(...segments) {
  return path.join(__dirname, '..', '..', 'assets', ...segments);
}

function getAvatarWindowConfig() {
  // Position in bottom-right corner of the primary display
  const { screen } = require('electron');
  const primary = screen.getPrimaryDisplay();
  const { width, height } = primary.workAreaSize;

  return {
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: width - WINDOW_WIDTH - 20,
    y: height - WINDOW_HEIGHT - AVATAR_Y_OFFSET,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  };
}

// ─── Window ───────────────────────────────────────────────────────────────────
function createMainWindow() {
  const config = getAvatarWindowConfig();
  mainWindow = new BrowserWindow(config);

  // Semi-transparent dark background for the UI overlay
  mainWindow.setBackgroundColor('#00000000');

  if (IS_DEV) {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('moved', () => {
    // Persist window position
  });

  console.log('[OPTIMA] Window created at:', mainWindow.getBounds());
}

// ─── Tray ─────────────────────────────────────────────────────────────────────
function createTray() {
  // Use a simple generated icon if no icon file exists
  let iconPath = getAssetPath('icons', 'tray-icon.png');
  let icon;

  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    // Create a minimal 16x16 icon programmatically
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon.isEmpty() ? nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADxSURBVDiNpZMxDsIwDEV/koqJhYmVjYWRkY2JhYGFqUOHOvWINPQKegRNHdo7OA6RISQaSUIW8fv6s/17Af4SjLFP3aVrZ+cJGHPObZqm3eMwnmfh/n4vy1IAsNYyxpi+KIo8DEPf9303DANfFIW7u7tz3/dXz/NAa+0opVQCkOd56bquM3Dbtu0sy3LDMPB9381aaxVFQRAEZJq2bQ8AqqqKqqracwC6ruumaXrTNM2uKIpN0zQ7wzAyz/N0XddN0zTbuq6bpmm2TdNsAViWZRfAsiyrruu2LMu27bqdZVnWdV13Xdc1AKZpun3fX1mW5aIoyl3f93ZZlpssy7Jt27YDYJqmuwBIkv4C3wF/Ru4P4fE0dQAAAABJRU5ErkJggg==') : icon);

  tray.setToolTip('OPTIMA 🤖');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show OPTIMA',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: 'Hide Avatar',
      click: () => mainWindow.webContents.send('avatar:toggle'),
    },
    { type: 'separator' },
    {
      label: 'Push-to-Talk',
      accelerator: 'CmdOrCtrl+Shift+O',
      click: () => mainWindow.webContents.send('voice:ptt-start'),
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        mainWindow.show();
        mainWindow.webContents.send('navigate:settings');
      },
    },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

// ─── Shortcuts ────────────────────────────────────────────────────────────────
function registerShortcuts() {
  // Push-to-talk
  globalShortcut.register('CmdOrCtrl+Shift+O', () => {
    mainWindow?.webContents.send('voice:ptt-start');
  });

  // Toggle avatar visibility
  globalShortcut.register('CmdOrCtrl+Shift+H', () => {
    mainWindow?.webContents.send('avatar:toggle');
  });

  // Quit (Cmd+Q still works via app menu)
  globalShortcut.register('CmdOrCtrl+Shift+Q', () => {
    isQuitting = true;
    app.quit();
  });
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────
function setupIPC() {
  // Screen capture
  ipcMain.handle('screen:capture', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      });
      if (sources.length === 0) return null;
      return sources[0].thumbnail.toDataURL();
    } catch (err) {
      console.error('[OPTIMA] Screen capture error:', err);
      return null;
    }
  });

  // Window control
  ipcMain.on('window:hide', () => mainWindow.hide());
  ipcMain.on('window:toggle-visibility', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });

  // Voice session
  ipcMain.on('voice:session-start', () => {
    console.log('[OPTIMA] Voice session started');
  });
  ipcMain.on('voice:session-end', () => {
    console.log('[OPTIMA] Voice session ended');
  });

  // OpenClaw handoff
  ipcMain.handle('openclaw:handoff', async (event, { context, transcript }) => {
    console.log('[OPTIMA] OpenClaw handoff requested:', transcript?.slice(0, 100));
    // This will be implemented in Phase 5
    // Calls OpenClaw via local HTTP API or spawns a session
    return { status: 'ok', message: 'Handoff implemented in Phase 5' };
  });

  // Avatar state
  ipcMain.on('avatar:set-state', (event, state) => {
    console.log('[OPTIMA] Avatar state:', state);
  });

  // App info
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    node: process.versions.node,
  }));
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  console.log('[OPTIMA] Starting up... v' + app.getVersion());

  setupIPC();
  createMainWindow();
  createTray();
  registerShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      mainWindow.show();
    }
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle Squirrel events (macOS app install)
if (require('electron-squirrel-startup')) {
  app.quit();
}
