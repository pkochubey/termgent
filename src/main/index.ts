import { app, BrowserWindow, ipcMain, globalShortcut, dialog, Notification } from 'electron';
import path from 'path';
import fs from 'fs';
import { AppStore } from './store.js';
import { PtyManager } from './pty.js';
import { GitService } from './gitService.js';
import { AgentService, AGENT_PRESETS } from './agentService.js';
import { ControlServer } from './controlServer.js';
import { ApprovalDetector } from './approvalDetector.js';
import { IPC_CHANNELS, HudConfig } from '../shared/types.js';

if (process.platform === 'win32') {
  app.setAppUserModelId('com.termgent.app');
}

let mainWindow: BrowserWindow | null = null;
const store = new AppStore();
const ptyManager = new PtyManager();
const gitService = new GitService();
const agentService = new AgentService();
const approvalDetector = new ApprovalDetector(store, ptyManager);
let controlServer: ControlServer;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 800,
    minHeight: 500,
    frame: true,
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, '../../build/icon.png'),
    titleBarOverlay: {
      color: '#18181b',
      symbolColor: '#a1a1aa',
      height: 35,
    },
    backgroundColor: '#09090b',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Load Error] ${errorCode}: ${errorDescription} (${validatedURL})`);
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow?.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  const rendererHtml = path.join(__dirname, '../renderer/index.html');
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (fs.existsSync(rendererHtml)) {
    mainWindow.loadFile(rendererHtml);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Wire up global PTY output dispatcher to renderer
  ptyManager.setOnDataListener((sessionId, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.PTY_OUTPUT, { sessionId, data });
    }
  });

  // Ensure active session PTY exists
  const state = store.getState();
  if (state.activeSessionId && state.sessions[state.activeSessionId]) {
    const activeSession = state.sessions[state.activeSessionId];
    ptyManager.spawn(activeSession.id, activeSession.currentCwd);
    if (activeSession.hasSplit) {
      ptyManager.spawn(`${activeSession.id}:split`, activeSession.splitCwd || activeSession.currentCwd);
    }
  }
}

app.whenReady().then(() => {
  createWindow();
  approvalDetector.start();

  // Control Server start
  controlServer = new ControlServer(store, ptyManager, () => mainWindow);
  controlServer.start();



  // Background Git Status Refresh Loop
  setInterval(async () => {
    const state = store.getState();
    if (state.activeSessionId && state.sessions[state.activeSessionId]) {
      const activeSession = state.sessions[state.activeSessionId];
      const status = await gitService.getGitStatus(activeSession.currentCwd);
      store.updateGitStatus(activeSession.id, status);
    }
  }, 3000);
});

// Broadcast state updates to renderer
store.onChange((state) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.STATE_UPDATED, state);
  }
});

// IPC Setup
ipcMain.handle(IPC_CHANNELS.STATE_GET, () => store.getState());

ipcMain.on(IPC_CHANNELS.WORKSPACE_CREATE, (_, name: string) => store.addWorkspace(name));
ipcMain.on(IPC_CHANNELS.WORKSPACE_SELECT, (_, id: string) => store.selectWorkspace(id));
ipcMain.on(IPC_CHANNELS.WORKSPACE_RENAME, (_, { id, name }: { id: string; name: string }) =>
  store.renameWorkspace(id, name)
);
ipcMain.on(IPC_CHANNELS.WORKSPACE_DELETE, (_, id: string) => store.deleteWorkspace(id));
ipcMain.on(IPC_CHANNELS.WORKSPACE_TOGGLE_FOCUS, (_, id: string) => store.toggleWorkspaceFocus(id));
ipcMain.on(IPC_CHANNELS.WORKSPACE_FILTER_CLEAR, () => store.clearWorkspaceFilter());
ipcMain.on(IPC_CHANNELS.WORKSPACE_TOGGLE_COLLAPSE, (_, id: string) => store.toggleWorkspaceCollapse(id));

ipcMain.on(
  IPC_CHANNELS.SESSION_CREATE,
  (_, { workspaceId, cwd, name }: { workspaceId?: string; cwd?: string; name?: string }) => {
    const session = store.addSession(workspaceId, cwd, name);
    ptyManager.spawn(session.id, session.currentCwd);
  }
);

ipcMain.on(IPC_CHANNELS.SESSION_SELECT, (_, id: string) => {
  const state = store.getState();
  if (!state.sessions[id]) return;

  store.selectSession(id);
  ptyManager.spawn(id, state.sessions[id].currentCwd);
  if (state.sessions[id].hasSplit) {
    ptyManager.spawn(`${id}:split`, state.sessions[id].splitCwd || state.sessions[id].currentCwd);
  }
});

ipcMain.on(IPC_CHANNELS.SESSION_RENAME, (_, { id, name }: { id: string; name: string }) =>
  store.renameSession(id, name)
);

ipcMain.on(IPC_CHANNELS.SESSION_CLOSE, (_, id: string) => {
  ptyManager.kill(id);
  ptyManager.kill(`${id}:split`);
  store.closeSession(id);
});

ipcMain.on(IPC_CHANNELS.SESSION_UNDO_CLOSE, () => {
  const restored = store.undoCloseSession();
  if (restored) {
    ptyManager.spawn(restored.id, restored.currentCwd);
  }
});

ipcMain.on(IPC_CHANNELS.SESSION_SPLIT_TOGGLE, (_, id: string) => {
  const hasSplit = store.toggleSessionSplit(id);
  const session = store.getState().sessions[id];
  if (hasSplit && session) {
    ptyManager.spawn(`${id}:split`, session.splitCwd || session.currentCwd);
  } else {
    ptyManager.kill(`${id}:split`);
  }
});

ipcMain.on(IPC_CHANNELS.SESSION_SPLIT_RESIZE, (_, { id, ratio }: { id: string; ratio: number }) => {
  store.setSessionSplitRatio(id, ratio);
});

ipcMain.on(IPC_CHANNELS.SESSION_SPLIT_FOCUS, (_, { id, focus }: { id: string; focus: 'left' | 'right' }) => {
  store.setSessionSplitFocus(id, focus);
});

ipcMain.on(IPC_CHANNELS.SESSION_REVIEW_TOGGLE, (_, id: string) => {
  store.toggleSessionReview(id);
});

ipcMain.handle(IPC_CHANNELS.GIT_GET_DIFF, async (_, cwd: string) => {
  return gitService.getGitDiff(cwd);
});

ipcMain.on(
  IPC_CHANNELS.SESSION_SET_STATUS,
  (_, { id, status }: { id: string; status: 'idle' | 'active' | 'blocked' | 'completed' }) => {
    store.setSessionStatus(id, status);

    const session = store.getState().sessions[id];
    if (session) {
      if (mainWindow && !mainWindow.isFocused()) {
        mainWindow.flashFrame(true);
      }

      if (Notification.isSupported()) {
        const iconPath = path.join(__dirname, '../../build/icon.png');
        if (status === 'completed') {
          new Notification({
            title: 'Termgent — Session Completed',
            body: `Task completed in "${session.name}"`,
            icon: fs.existsSync(iconPath) ? iconPath : undefined,
          }).show();
        } else if (status === 'blocked') {
          new Notification({
            title: 'Termgent — Action Required',
            body: `Session "${session.name}" is waiting for your input`,
            icon: fs.existsSync(iconPath) ? iconPath : undefined,
          }).show();
        }
      }
    }
  }
);

ipcMain.on(IPC_CHANNELS.HUD_SET, (_, config: HudConfig) => {
  store.setSessionHud(config);
});

ipcMain.on(IPC_CHANNELS.HUD_CLOSE, (_, sessionId: string) => {
  store.closeSessionHud(sessionId);
});

ipcMain.on(IPC_CHANNELS.THEME_SET, (_, theme: string) => {
  store.setTheme(theme);
});

ipcMain.handle(IPC_CHANNELS.OPEN_DIRECTORY_DIALOG, async () => {
  if (!mainWindow) return null;
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Working Directory for New Session',
  });
  if (!res.canceled && res.filePaths.length > 0) {
    return res.filePaths[0];
  }
  return null;
});

ipcMain.handle(IPC_CHANNELS.PTY_ATTACH, (_, { sessionId }: { sessionId: string }) => {
  const state = store.getState();
  const baseSessionId = sessionId.replace(':split', '');
  const session = state.sessions[baseSessionId];
  if (!session) return { buffer: '' };

  const cwd = sessionId.endsWith(':split') ? session.splitCwd || session.currentCwd : session.currentCwd;
  ptyManager.spawn(sessionId, cwd);
  return { buffer: ptyManager.getText(sessionId, 500) };
});

const sessionInputBuffers = new Map<string, string>();

ipcMain.on(IPC_CHANNELS.PTY_INPUT, (_, { sessionId, data }: { sessionId: string; data: string }) => {
  const baseSessionId = sessionId.replace(':split', '');
  const session = store.getState().sessions[baseSessionId];
  if (session && session.status === 'completed') {
    const isRealKeyPress =
      typeof data === 'string' &&
      data.length > 0 &&
      !data.startsWith('\x1b') &&
      data !== '\x00';

    if (isRealKeyPress) {
      store.setSessionStatus(baseSessionId, 'idle');
    }
  }

  // Track command line entry to save CLI agent history & restore command
  if (typeof data === 'string') {
    let currentBuf = sessionInputBuffers.get(baseSessionId) || '';
    if (data.includes('\r') || data.includes('\n')) {
      const fullCmd = (currentBuf + data.replace(/[\r\n]/g, '')).trim();
      sessionInputBuffers.set(baseSessionId, '');

      if (fullCmd.length > 0) {
        const lower = fullCmd.toLowerCase();
        let detectedAgent: any = undefined;
        if (lower.startsWith('qwen') || lower.includes(' qwen') || lower.includes('qwen-code')) {
          detectedAgent = 'qwen';
        } else if (lower.startsWith('codex') || lower.includes(' codex')) {
          detectedAgent = 'codex';
        } else if (lower.startsWith('agy') || lower.includes(' agy') || lower.includes('antigravity')) {
          detectedAgent = 'antigravity';
        } else if (lower.startsWith('copilot') || lower.includes('gh copilot') || lower.includes(' copilot')) {
          detectedAgent = 'copilot';
        } else if (lower.startsWith('claude') || lower.includes(' claude')) {
          detectedAgent = 'claude';
        }

        store.updateSessionCommand(baseSessionId, fullCmd, detectedAgent);
      }
    } else if (data === '\x08' || data === '\x7f') {
      sessionInputBuffers.set(baseSessionId, currentBuf.slice(0, -1));
    } else if (data.length === 1 && data >= ' ') {
      sessionInputBuffers.set(baseSessionId, currentBuf + data);
    }
  }

  ptyManager.write(sessionId, data);
});

ipcMain.on(IPC_CHANNELS.PTY_PWD_CHANGED, (_, { sessionId, cwd }: { sessionId: string; cwd: string }) => {
  const baseSessionId = sessionId.replace(':split', '');
  store.updateSessionCwd(baseSessionId, cwd);
});

ipcMain.on(
  IPC_CHANNELS.PTY_RESIZE,
  (_, { sessionId, cols, rows }: { sessionId: string; cols: number; rows: number }) => {
    ptyManager.resize(sessionId, cols, rows);
  }
);

ipcMain.on(
  IPC_CHANNELS.PICKER_SUBMIT,
  (_, { pickerId, selection }: { pickerId: string; selection: string }) => {
    if (controlServer) {
      controlServer.resolvePicker(pickerId, selection);
    }
  }
);

ipcMain.on(
  IPC_CHANNELS.PICKER_CANCEL,
  (_, { pickerId }: { pickerId: string }) => {
    if (controlServer) {
      controlServer.resolvePicker(pickerId, '');
    }
  }
);

ipcMain.handle(IPC_CHANNELS.AGENT_LOCAL_STATUS, async () => {
  const info = await agentService.checkLocalLlm();
  store.setLocalLlmStatus(info);
  return info;
});

ipcMain.on(IPC_CHANNELS.AGENT_START, (_, { agent, workspaceId, cwd, model }: any) => {
  const preset = AGENT_PRESETS.find((p) => p.id === agent);
  const name = preset ? `${preset.icon} ${preset.name.split(' ')[0]}` : `🤖 ${agent}`;
  const targetWsId = workspaceId || store.getState().activeWorkspaceId;

  const session = store.addSession(targetWsId, cwd, name, 'idle', agent);
  ptyManager.spawn(session.id, session.currentCwd);

  let runCmd = preset ? preset.command : agent;
  if (agent === 'qwen' && model) {
    runCmd = `ollama run ${model}`;
  }

  setTimeout(() => {
    ptyManager.write(session.id, `agrun ${runCmd}\r`);
  }, 600);
});

// Periodic local LLM polling (every 10s)
setInterval(async () => {
  try {
    const info = await agentService.checkLocalLlm();
    store.setLocalLlmStatus(info);
  } catch (e) {}
}, 10000);

agentService.checkLocalLlm().then((info) => store.setLocalLlmStatus(info)).catch(() => {});

app.on('window-all-closed', () => {
  ptyManager.killAll();
  if (controlServer) controlServer.stop();
  if (process.platform !== 'darwin') app.quit();
});
