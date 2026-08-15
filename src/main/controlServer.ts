import net from 'net';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { AppStore } from './store.js';
import { PtyManager } from './pty.js';
import { AgentService, AGENT_PRESETS } from './agentService.js';
import { BrowserWindow } from 'electron';
import { IPC_CHANNELS, HudConfig, AgentType } from '../shared/types.js';

export interface ControlRequest {
  command: string;
  args?: Record<string, any>;
}

export interface ControlResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class ControlServer {
  private pipePath = '\\\\.\\pipe\\termgent-socket';
  private port = 9090;
  private store: AppStore;
  private ptyManager: PtyManager;
  private agentService: AgentService;
  private getMainWindow: () => BrowserWindow | null;
  private pipeServer?: net.Server;
  private httpServer?: http.Server;
  private activePickers: Map<string, (result: string) => void> = new Map();

  constructor(
    store: AppStore,
    ptyManager: PtyManager,
    getMainWindow: () => BrowserWindow | null
  ) {
    this.store = store;
    this.ptyManager = ptyManager;
    this.agentService = new AgentService();
    this.getMainWindow = getMainWindow;
  }

  public start(): void {
    const configDir = path.join(process.env.LOCALAPPDATA || process.env.APPDATA || '.', 'termgent');
    if (!fs.existsSync(configDir)) {
      try {
        fs.mkdirSync(configDir, { recursive: true });
      } catch (e) {}
    }

    // 1. Windows Named Pipe Server
    try {
      this.pipeServer = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.pipeServer.on('error', (err: any) => {
        console.warn('[ControlServer] Named pipe notice:', err.message);
      });

      this.pipeServer.listen(this.pipePath, () => {
        console.log(`Termgent Control Pipe listening on ${this.pipePath}`);
      });
    } catch (e) {
      console.warn('[ControlServer] Named Pipe listen error:', e);
    }

    // 2. HTTP JSON API Server
    try {
      this.httpServer = http.createServer((req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', async () => {
            try {
              const request: ControlRequest = JSON.parse(body);
              const response = await this.handleCommand(request);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(response));
            } catch (err: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
        } else {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Termgent control server active');
        }
      });

      this.httpServer.on('error', (err: any) => {
        console.warn('[ControlServer] HTTP server notice:', err.message);
      });

      this.httpServer.listen(this.port, '127.0.0.1', () => {
        console.log(`Termgent HTTP API listening on http://127.0.0.1:${this.port}`);
        try {
          fs.writeFileSync(
            path.join(configDir, 'control.json'),
            JSON.stringify({ port: this.port, pipe: this.pipePath, pid: process.pid }),
            'utf-8'
          );
        } catch (e) {}
      });
    } catch (e) {
      console.warn('[ControlServer] HTTP server listen error:', e);
    }
  }

  private handleConnection(socket: net.Socket): void {
    let buffer = '';
    socket.on('data', async (data) => {
      buffer += data.toString('utf-8');
      if (buffer.endsWith('\n') || buffer.endsWith('\r')) {
        try {
          const req: ControlRequest = JSON.parse(buffer.trim());
          const resp = await this.handleCommand(req);
          socket.write(JSON.stringify(resp) + '\n');
        } catch (e: any) {
          socket.write(JSON.stringify({ success: false, error: e.message }) + '\n');
        }
        buffer = '';
      }
    });
  }

  public resolvePicker(pickerId: string, selection: string): void {
    const resolver = this.activePickers.get(pickerId);
    if (resolver) {
      resolver(selection);
      this.activePickers.delete(pickerId);
    }
  }

  private async handleCommand(req: ControlRequest): Promise<ControlResponse> {
    const state = this.store.getState();
    const args = req.args || {};

    switch (req.command) {
      // Workspaces
      case 'workspace.list':
        return { success: true, data: state.workspaces };

      case 'workspace.new': {
        const name = args.name || 'workspace';
        const ws = this.store.addWorkspace(name);
        return { success: true, data: { id: ws.id, name: ws.name } };
      }

      case 'workspace.rename': {
        const targetId = args.id || state.activeWorkspaceId;
        this.store.renameWorkspace(targetId, args.name);
        return { success: true, data: { id: targetId } };
      }

      case 'workspace.close': {
        const targetId = args.id || state.activeWorkspaceId;
        this.store.deleteWorkspace(targetId);
        return { success: true, data: { success: true } };
      }

      case 'workspace.filter': {
        if (args.clear) {
          this.store.clearWorkspaceFilter();
          return { success: true, data: { focused: [] } };
        }
        const wsId = args.id || state.activeWorkspaceId;
        this.store.toggleWorkspaceFocus(wsId);
        return { success: true, data: { focused: this.store.getState().focusedWorkspaceIds } };
      }

      // Sessions
      case 'session.list':
        return { success: true, data: Object.values(state.sessions) };

      case 'session.new': {
        const wsId = args.workspace || state.activeWorkspaceId;
        const cwd = args.cwd;
        const name = args.name;
        const session = this.store.addSession(wsId, cwd, name);

        this.ptyManager.spawn(session.id, session.currentCwd);

        if (!args.noSelect) {
          this.store.selectSession(session.id);
        }

        return { success: true, data: { id: session.id, name: session.name } };
      }

      case 'session.select': {
        const targetId = this.resolveSessionTarget(args.target);
        if (targetId) {
          this.store.selectSession(targetId);
          return { success: true, data: { id: targetId } };
        }
        return { success: false, error: 'Session not found' };
      }

      case 'session.type': {
        const targetId = this.resolveSessionTarget(args.target) || state.activeSessionId;
        if (!targetId) return { success: false, error: 'No active session' };

        const targetPty = args.pane === 'right' ? `${targetId}:split` : targetId;
        const text = args.text || '';
        this.ptyManager.write(targetPty, text);
        return { success: true, data: { typed: text.length } };
      }

      case 'session.text': {
        const targetId = this.resolveSessionTarget(args.target) || state.activeSessionId;
        if (!targetId) return { success: false, error: 'No active session' };

        const targetPty = args.pane === 'right' ? `${targetId}:split` : targetId;
        const lines = args.lines || 100;
        const text = this.ptyManager.getText(targetPty, lines);
        return { success: true, data: text };
      }

      case 'session.status': {
        const targetId = this.resolveSessionTarget(args.target) || state.activeSessionId;
        if (!targetId) return { success: false, error: 'No active session' };

        const status = args.status;
        if (['active', 'blocked', 'completed', 'idle'].includes(status)) {
          this.store.setSessionStatus(targetId, status);
          return { success: true, data: { id: targetId, status } };
        }
        return { success: false, error: 'Invalid status. Expected active|blocked|completed|idle' };
      }

      case 'session.split': {
        const targetId = this.resolveSessionTarget(args.target) || state.activeSessionId;
        if (!targetId) return { success: false, error: 'No active session' };

        const hasSplit = this.store.toggleSessionSplit(targetId);
        const session = this.store.getState().sessions[targetId];
        if (hasSplit && session) {
          this.ptyManager.spawn(`${targetId}:split`, session.splitCwd || session.currentCwd);
        } else {
          this.ptyManager.kill(`${targetId}:split`);
        }
        return { success: true, data: { id: targetId, hasSplit } };
      }

      case 'session.review': {
        const targetId = this.resolveSessionTarget(args.target) || state.activeSessionId;
        if (!targetId) return { success: false, error: 'No active session' };
        const isReviewOpen = this.store.toggleSessionReview(targetId);
        return { success: true, data: { id: targetId, isReviewOpen } };
      }

      case 'session.split.ratio': {
        const targetId = this.resolveSessionTarget(args.target) || state.activeSessionId;
        if (!targetId) return { success: false, error: 'No active session' };
        const ratio = parseFloat(args.ratio) || 0.5;
        this.store.setSessionSplitRatio(targetId, ratio);
        return { success: true, data: { id: targetId, ratio } };
      }

      case 'session.split.focus': {
        const targetId = this.resolveSessionTarget(args.target) || state.activeSessionId;
        if (!targetId) return { success: false, error: 'No active session' };
        const focus = args.focus === 'right' ? 'right' : 'left';
        this.store.setSessionSplitFocus(targetId, focus);
        return { success: true, data: { id: targetId, focus } };
      }

      case 'session.hud': {
        const targetId = this.resolveSessionTarget(args.target) || state.activeSessionId;
        if (!targetId) return { success: false, error: 'No active session' };

        if (args.close) {
          this.store.closeSessionHud(targetId);
          return { success: true, data: { id: targetId, closed: true } };
        }

        const hudConfig: HudConfig = {
          sessionId: targetId,
          message: args.message || 'Operation in progress...',
          detail: args.detail,
          spinner: args.spinner ?? true,
          position: args.position || 'top-right',
        };
        this.store.setSessionHud(hudConfig);
        return { success: true, data: hudConfig };
      }

      case 'session.undo': {
        const restored = this.store.undoCloseSession();
        if (restored) {
          this.ptyManager.spawn(restored.id, restored.currentCwd);
          return { success: true, data: restored };
        }
        return { success: false, error: 'No recently closed session to restore' };
      }

      case 'session.close': {
        const targetId = this.resolveSessionTarget(args.target) || state.activeSessionId;
        if (targetId) {
          this.ptyManager.kill(targetId);
          this.ptyManager.kill(`${targetId}:split`);
          this.store.closeSession(targetId);
          return { success: true, data: { closed: targetId } };
        }
        return { success: false, error: 'Session not found' };
      }

      // Picker
      case 'pick': {
        const win = this.getMainWindow();
        if (!win) return { success: false, error: 'No main window' };

        const pickerId = `picker-${Date.now()}`;
        const promptText = args.prompt || args.query || 'Select:';
        const options: Array<{ id: string; label: string }> = (args.options || []).map(
          (opt: any, idx: number) => {
            if (typeof opt === 'string') return { id: opt, label: opt };
            return { id: opt.id || String(idx), label: opt.label || String(opt) };
          }
        );

        return new Promise<ControlResponse>((resolve) => {
          this.activePickers.set(pickerId, (selection) => {
            resolve({ success: true, data: selection });
          });

          win.webContents.send(IPC_CHANNELS.PICKER_SHOW, {
            id: pickerId,
            title: promptText,
            items: options,
            allowFreeText: args.allowFreeText ?? false,
          });
        });
      }

      // Agent Management & Presets
      case 'agent.list': {
        const installed = await this.agentService.detectInstalledAgents();
        const localLlm = await this.agentService.checkLocalLlm();
        return {
          success: true,
          data: {
            presets: AGENT_PRESETS.map((p) => ({
              ...p,
              installed: !!installed[p.id],
            })),
            localLlm,
          },
        };
      }

      case 'agent.start': {
        const agentType = (args.agent || args.type || 'qwen') as AgentType;
        const preset = AGENT_PRESETS.find((p) => p.id === agentType);
        const name = preset ? `${preset.icon} ${preset.name.split(' ')[0]}` : `🤖 ${agentType}`;
        const wsId = args.workspace || state.activeWorkspaceId;
        const cwd = args.cwd;

        const session = this.store.addSession(wsId, cwd, name, 'idle', agentType);
        this.ptyManager.spawn(session.id, session.currentCwd);

        let runCmd = preset ? preset.command : agentType;
        if (agentType === 'qwen' && args.model) {
          runCmd = `ollama run ${args.model}`;
        }

        setTimeout(() => {
          this.ptyManager.write(session.id, `agrun ${runCmd}\r`);
        }, 600);

        if (!args.noSelect) {
          this.store.selectSession(session.id);
        }

        return { success: true, data: { id: session.id, name, agent: agentType } };
      }

      case 'agent.local_status': {
        const localLlm = await this.agentService.checkLocalLlm();
        this.store.setLocalLlmStatus(localLlm);
        return { success: true, data: localLlm };
      }

      // Themes
      case 'theme': {
        const themeName = args.name || 'campbell';
        this.store.setTheme(themeName);
        return { success: true, data: { theme: themeName } };
      }

      // Tree dump
      case 'tree':
        return { success: true, data: this.store.getState() };

      default:
        return { success: false, error: `Unknown command: ${req.command}` };
    }
  }

  private resolveSessionTarget(target?: string): string | null {
    if (!target) return this.store.getState().activeSessionId;
    const state = this.store.getState();

    // Check exact ID match
    if (state.sessions[target]) return target;

    // Check by name
    const match = Object.values(state.sessions).find(
      (s) => s.name.toLowerCase() === target.toLowerCase() || s.id.startsWith(target)
    );

    return match ? match.id : null;
  }

  public stop(): void {
    if (this.pipeServer) this.pipeServer.close();
    if (this.httpServer) this.httpServer.close();
  }
}
