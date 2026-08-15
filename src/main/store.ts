import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { AppState, HudConfig, Session, SessionStatus, Workspace, AgentType, LocalLlmInfo } from '../shared/types.js';

export class AppStore {
  private state: AppState;
  private storagePath: string;
  private onChangeCallbacks: Array<(state: AppState) => void> = [];
  private closedSessionsStack: Array<{ session: Session; workspaceId: string }> = [];

  constructor() {
    const userData = app?.getPath?.('userData') || path.join(process.env.APPDATA || '.', 'termgent');
    if (!fs.existsSync(userData)) {
      fs.mkdirSync(userData, { recursive: true });
    }
    this.storagePath = path.join(userData, 'workspaces.json');
    this.state = this.loadState();
  }

  private loadState(): AppState {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.workspaces && parsed.sessions) {
          // Reset all sessions to idle on cold app startup
          for (const session of Object.values(parsed.sessions as Record<string, Session>)) {
            session.status = 'idle';
          }
          return {
            ...parsed,
            focusedWorkspaceIds: parsed.focusedWorkspaceIds || [],
            hud: {},
            theme: parsed.theme || 'campbell',
          };
        }
      }
    } catch (e) {
      console.error('Failed to load state from disk:', e);
    }

    // Default state with one default workspace
    const defaultWsId = uuidv4();
    const defaultSessionId = uuidv4();
    const defaultCwd = process.env.USERPROFILE || process.cwd();

    const defaultWorkspace: Workspace = {
      id: defaultWsId,
      name: 'main',
      sessionIds: [defaultSessionId],
      isCollapsed: false,
    };

    const defaultSession: Session = {
      id: defaultSessionId,
      workspaceId: defaultWsId,
      name: path.basename(defaultCwd) || 'terminal',
      initialCwd: defaultCwd,
      currentCwd: defaultCwd,
      status: 'idle',
      hasSplit: false,
      splitRatio: 0.5,
      splitFocused: 'left',
    };

    return {
      workspaces: [defaultWorkspace],
      sessions: { [defaultSessionId]: defaultSession },
      activeWorkspaceId: defaultWsId,
      activeSessionId: defaultSessionId,
      focusedWorkspaceIds: [],
      hud: {},
      theme: 'campbell',
    };
  }

  public save(): void {
    try {
      fs.writeFileSync(this.storagePath, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save state:', e);
    }
    this.notify();
  }

  public getState(): AppState {
    return this.state;
  }

  public onChange(cb: (state: AppState) => void) {
    this.onChangeCallbacks.push(cb);
  }

  private notify() {
    for (const cb of this.onChangeCallbacks) {
      cb(this.state);
    }
  }

  // Workspaces
  public addWorkspace(name: string): Workspace {
    const ws: Workspace = {
      id: uuidv4(),
      name: name.trim() || 'workspace',
      sessionIds: [],
      isCollapsed: false,
    };
    this.state.workspaces.push(ws);

    // Auto-create initial session for new workspace
    this.addSession(ws.id);
    this.state.activeWorkspaceId = ws.id;
    this.save();
    return ws;
  }

  public selectWorkspace(wsId: string): void {
    const ws = this.state.workspaces.find((w) => w.id === wsId);
    if (ws) {
      this.state.activeWorkspaceId = ws.id;
      if (ws.sessionIds.length > 0) {
        this.state.activeSessionId = ws.sessionIds[0];
      }
      this.save();
    }
  }

  public renameWorkspace(wsId: string, newName: string): void {
    const ws = this.state.workspaces.find((w) => w.id === wsId);
    if (ws) {
      ws.name = newName.trim();
      this.save();
    }
  }

  public deleteWorkspace(wsId: string): void {
    if (this.state.workspaces.length <= 1) return; // Keep at least one

    const wsIndex = this.state.workspaces.findIndex((w) => w.id === wsId);
    if (wsIndex !== -1) {
      const ws = this.state.workspaces[wsIndex];
      // Clean up sessions
      for (const sid of ws.sessionIds) {
        delete this.state.sessions[sid];
      }
      this.state.workspaces.splice(wsIndex, 1);
      if (this.state.activeWorkspaceId === wsId) {
        const nextWs = this.state.workspaces[Math.max(0, wsIndex - 1)];
        this.state.activeWorkspaceId = nextWs.id;
        this.state.activeSessionId = nextWs.sessionIds[0] || null;
      }
      this.save();
    }
  }

  public toggleWorkspaceFocus(wsId: string): void {
    if (!this.state.focusedWorkspaceIds) this.state.focusedWorkspaceIds = [];
    const index = this.state.focusedWorkspaceIds.indexOf(wsId);
    if (index >= 0) {
      this.state.focusedWorkspaceIds.splice(index, 1);
    } else {
      this.state.focusedWorkspaceIds.push(wsId);
    }
    this.save();
  }

  public clearWorkspaceFilter(): void {
    this.state.focusedWorkspaceIds = [];
    this.save();
  }

  public toggleWorkspaceCollapse(wsId: string): void {
    const ws = this.state.workspaces.find((w) => w.id === wsId);
    if (ws) {
      ws.isCollapsed = !ws.isCollapsed;
      this.save();
    }
  }

  public addSession(
    workspaceId?: string,
    cwd?: string,
    customName?: string,
    status: SessionStatus = 'idle',
    agentType?: AgentType
  ): Session {
    const targetWsId = workspaceId || this.state.activeWorkspaceId;
    const ws = this.state.workspaces.find((w) => w.id === targetWsId);
    if (!ws) throw new Error(`Workspace not found: ${targetWsId}`);

    const sessionCwd = cwd || process.env.USERPROFILE || process.cwd();
    const sessionId = uuidv4();
    const sessionName = customName || path.basename(sessionCwd) || 'terminal';

    const session: Session = {
      id: sessionId,
      workspaceId: targetWsId,
      name: sessionName,
      customName: customName,
      initialCwd: sessionCwd,
      currentCwd: sessionCwd,
      status,
      agentType,
      hasSplit: false,
      splitRatio: 0.5,
      splitFocused: 'left',
    };

    this.state.sessions[sessionId] = session;
    ws.sessionIds.push(sessionId);

    this.state.activeWorkspaceId = targetWsId;
    this.state.activeSessionId = sessionId;
    this.save();

    return session;
  }

  public setLocalLlmStatus(info: LocalLlmInfo): void {
    this.state.localLlm = info;
    this.save();
  }

  public selectSession(sessionId: string): void {
    const session = this.state.sessions[sessionId];
    if (session) {
      this.state.activeSessionId = sessionId;
      this.state.activeWorkspaceId = session.workspaceId;
      this.save();

      // When switching to a completed tab, acknowledge and auto-clear after 2 seconds
      if (session.status === 'completed') {
        setTimeout(() => {
          const current = this.state.sessions[sessionId];
          if (current && current.status === 'completed' && this.state.activeSessionId === sessionId) {
            this.setSessionStatus(sessionId, 'idle');
          }
        }, 2000);
      }
    }
  }

  public renameSession(sessionId: string, newName: string): void {
    const session = this.state.sessions[sessionId];
    if (session) {
      session.customName = newName.trim();
      session.name = newName.trim() || path.basename(session.currentCwd);
      this.save();
    }
  }

  public updateSessionCommand(sessionId: string, command: string, agentType?: AgentType): void {
    const session = this.state.sessions[sessionId];
    if (session) {
      session.restoreCommand = command;
      if (agentType) {
        session.agentType = agentType;
      }
      this.save();
    }
  }

  public setSessionStatus(sessionId: string, status: SessionStatus): void {
    const session = this.state.sessions[sessionId];
    if (session) {
      session.status = status;
      this.save();

      // If marked completed while the user is already viewing this active tab:
      // Flash green for 3 seconds to indicate completion, then auto-clear to idle
      if (status === 'completed' && this.state.activeSessionId === sessionId) {
        setTimeout(() => {
          const current = this.state.sessions[sessionId];
          if (current && current.status === 'completed' && this.state.activeSessionId === sessionId) {
            this.setSessionStatus(sessionId, 'idle');
          }
        }, 3000);
      }
    }
  }

  public updateSessionCwd(sessionId: string, newCwd: string): void {
    const session = this.state.sessions[sessionId];
    if (session && session.currentCwd !== newCwd) {
      session.currentCwd = newCwd;
      if (!session.customName) {
        session.name = path.basename(newCwd) || 'terminal';
      }
      this.save();
    }
  }

  public updateGitStatus(sessionId: string, gitStatus: Session['gitStatus']): void {
    const session = this.state.sessions[sessionId];
    if (session) {
      session.gitStatus = gitStatus;
      this.notify();
    }
  }

  // Split Panes
  public toggleSessionSplit(sessionId: string): boolean {
    const session = this.state.sessions[sessionId];
    if (session) {
      session.hasSplit = !session.hasSplit;
      if (session.hasSplit) {
        session.splitRatio = session.splitRatio || 0.5;
        session.splitFocused = 'right';
        session.splitCwd = session.currentCwd;
      } else {
        session.splitFocused = 'left';
      }
      this.save();
      return !!session.hasSplit;
    }
    return false;
  }

  public toggleSessionReview(sessionId: string): boolean {
    const session = this.state.sessions[sessionId];
    if (session) {
      session.isReviewOpen = !session.isReviewOpen;
      this.save();
      return !!session.isReviewOpen;
    }
    return false;
  }

  public setSessionSplitRatio(sessionId: string, ratio: number): void {
    const session = this.state.sessions[sessionId];
    if (session && session.hasSplit) {
      session.splitRatio = Math.max(0.15, Math.min(0.85, ratio));
      this.save();
    }
  }

  public setSessionSplitFocus(sessionId: string, focus: 'left' | 'right'): void {
    const session = this.state.sessions[sessionId];
    if (session) {
      session.splitFocused = focus;
      this.save();
    }
  }

  // HUD
  public setSessionHud(config: HudConfig): void {
    if (!this.state.hud) this.state.hud = {};
    this.state.hud[config.sessionId] = config;
    this.notify();
  }

  public closeSessionHud(sessionId: string): void {
    if (this.state.hud && this.state.hud[sessionId]) {
      delete this.state.hud[sessionId];
      this.notify();
    }
  }

  // Theme
  public setTheme(theme: string): void {
    this.state.theme = theme;
    this.save();
  }

  // Close & Undo Close
  public closeSession(sessionId: string): void {
    const session = this.state.sessions[sessionId];
    if (!session) return;

    const ws = this.state.workspaces.find((w) => w.id === session.workspaceId);
    if (ws) {
      // Save for Undo Close
      this.closedSessionsStack.push({
        session: { ...session },
        workspaceId: ws.id,
      });
      if (this.closedSessionsStack.length > 20) {
        this.closedSessionsStack.shift();
      }

      ws.sessionIds = ws.sessionIds.filter((id) => id !== sessionId);
      delete this.state.sessions[sessionId];

      // If active session was deleted, select neighbor
      if (this.state.activeSessionId === sessionId) {
        this.state.activeSessionId = ws.sessionIds[ws.sessionIds.length - 1] || null;
      }

      // Ensure workspace has at least 1 session if active
      if (ws.sessionIds.length === 0) {
        this.addSession(ws.id);
      } else {
        this.save();
      }
    }
  }

  public undoCloseSession(): Session | null {
    if (this.closedSessionsStack.length === 0) return null;
    const item = this.closedSessionsStack.pop();
    if (!item) return null;

    let ws = this.state.workspaces.find((w) => w.id === item.workspaceId);
    if (!ws) {
      ws = this.state.workspaces[0];
    }
    if (!ws) return null;

    const restoredSession: Session = {
      ...item.session,
      id: uuidv4(),
      workspaceId: ws.id,
      status: 'idle',
    };

    this.state.sessions[restoredSession.id] = restoredSession;
    ws.sessionIds.push(restoredSession.id);
    this.state.activeWorkspaceId = ws.id;
    this.state.activeSessionId = restoredSession.id;
    this.save();

    return restoredSession;
  }
}
