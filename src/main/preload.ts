import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getState: () => ipcRenderer.invoke('state:get'),
  onStateUpdated: (callback: (state: any) => void) => {
    const listener = (_: any, state: any) => callback(state);
    ipcRenderer.on('state:updated', listener);
    return () => ipcRenderer.removeListener('state:updated', listener);
  },

  // Workspaces
  createWorkspace: (name: string) => ipcRenderer.send('workspace:create', name),
  selectWorkspace: (id: string) => ipcRenderer.send('workspace:select', id),
  renameWorkspace: (id: string, name: string) =>
    ipcRenderer.send('workspace:rename', { id, name }),
  deleteWorkspace: (id: string) => ipcRenderer.send('workspace:delete', id),
  toggleWorkspaceFocus: (id: string) => ipcRenderer.send('workspace:toggle-focus', id),
  clearWorkspaceFilter: () => ipcRenderer.send('workspace:filter-clear'),
  toggleWorkspaceCollapse: (id: string) => ipcRenderer.send('workspace:toggle-collapse', id),

  // Sessions
  createSession: (opts?: { workspaceId?: string; cwd?: string; name?: string }) =>
    ipcRenderer.send('session:create', opts || {}),
  selectSession: (id: string) => ipcRenderer.send('session:select', id),
  renameSession: (id: string, name: string) =>
    ipcRenderer.send('session:rename', { id, name }),
  closeSession: (id: string) => ipcRenderer.send('session:close', id),
  undoCloseSession: () => ipcRenderer.send('session:undo-close'),
  setSessionStatus: (id: string, status: string) =>
    ipcRenderer.send('session:set-status', { id, status }),

  // Split Panes
  toggleSplit: (sessionId: string) => ipcRenderer.send('session:split-toggle', sessionId),
  toggleReview: (sessionId: string) => ipcRenderer.send('session:review-toggle', sessionId),
  getGitDiff: (cwd: string) => ipcRenderer.invoke('git:get-diff', cwd),
  resizeSplit: (sessionId: string, ratio: number) =>
    ipcRenderer.send('session:split-resize', { id: sessionId, ratio }),
  focusSplit: (sessionId: string, focus: 'left' | 'right') =>
    ipcRenderer.send('session:split-focus', { id: sessionId, focus }),

  // PTY IO
  sendPtyInput: (sessionId: string, data: string) =>
    ipcRenderer.send('pty:input', { sessionId, data }),
  attachPty: (sessionId: string) =>
    ipcRenderer.invoke('pty:attach', { sessionId }),
  resizePty: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.send('pty:resize', { sessionId, cols, rows }),
  onPtyOutput: (callback: (data: { sessionId: string; data: string }) => void) => {
    const listener = (_: any, payload: any) => callback(payload);
    ipcRenderer.on('pty:output', listener);
    return () => ipcRenderer.removeListener('pty:output', listener);
  },

  // HUD
  setSessionHud: (config: any) => ipcRenderer.send('hud:set', config),
  closeSessionHud: (sessionId: string) => ipcRenderer.send('hud:close', sessionId),

  // Overlays, Pickers & Dashboard
  onOverlayStart: (callback: (overlay: any) => void) => {
    const listener = (_: any, overlay: any) => callback(overlay);
    ipcRenderer.on('overlay:start', listener);
    return () => ipcRenderer.removeListener('overlay:start', listener);
  },
  onPickerShow: (callback: (picker: any) => void) => {
    const listener = (_: any, picker: any) => callback(picker);
    ipcRenderer.on('picker:show', listener);
    return () => ipcRenderer.removeListener('picker:show', listener);
  },
  submitPicker: (pickerId: string, selection: string) =>
    ipcRenderer.send('picker:submit', { pickerId, selection }),
  cancelPicker: (pickerId: string) =>
    ipcRenderer.send('picker:cancel', { pickerId }),
  onDashboardOpen: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('dashboard:open', listener);
    return () => ipcRenderer.removeListener('dashboard:open', listener);
  },

  // Themes & Dialogs
  setTheme: (theme: string) => ipcRenderer.send('theme:set', theme),
  onToggleScratch: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('scratch:toggle', listener);
    return () => ipcRenderer.removeListener('scratch:toggle', listener);
  },
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:open-directory'),

  // AI Agents & Local LLM
  startAgent: (agentType: string, opts?: { workspaceId?: string; cwd?: string; model?: string }) =>
    ipcRenderer.send('agent:start', { agent: agentType, ...opts }),
  checkLocalLlm: () => ipcRenderer.invoke('agent:local-status'),
});
