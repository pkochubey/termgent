import os from 'os';
import path from 'path';

// Direct require for native CJS node-pty module in Electron
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pty = require('node-pty');

export interface PtyInstance {
  id: string;
  process: any;
  cols: number;
  rows: number;
  buffer: string[];
  currentLine: string;
  rollingRaw: string;
  lastDataTime: number;
  maxBufferLines: number;
}

export class PtyManager {
  private pties: Map<string, PtyInstance> = new Map();
  private onDataEmitter?: (sessionId: string, data: string) => void;

  public setOnDataListener(cb: (sessionId: string, data: string) => void): void {
    this.onDataEmitter = cb;
  }

  public spawn(
    sessionId: string,
    cwd?: string,
    cols = 80,
    rows = 24
  ): PtyInstance {
    // If already spawned, return existing process so state/cwd is preserved!
    const existing = this.pties.get(sessionId);
    if (existing) {
      return existing;
    }

    // Determine shell on Windows
    const shell = process.env.COMSPEC || 'powershell.exe';
    const targetCwd = cwd && cwd.trim() ? cwd : process.env.USERPROFILE || os.homedir();

    // Automatically inject Termgent CLI tools directory into PATH for this terminal
    const cliDir = path.resolve(__dirname, '../cli');
    const userTermgentBin = path.join(process.env.USERPROFILE || os.homedir(), '.termgent', 'bin');
    const existingPath = process.env.PATH || process.env.Path || '';
    const newPath = `${cliDir};${userTermgentBin};${existingPath}`;

    const env: Record<string, string> = {
      ...process.env,
      PATH: newPath,
      Path: newPath,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      TERM_PROGRAM: 'termgent',
      TERM_PROGRAM_VERSION: '1.0.0',
      FORCE_COLOR: '1',
      TERMGENT_SESSION_ID: sessionId,
    };

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: targetCwd,
      env,
      useConpty: true,
      conptyInheritCursor: false,
    });

    const instance: PtyInstance = {
      id: sessionId,
      process: ptyProcess,
      cols,
      rows,
      buffer: [],
      currentLine: '',
      rollingRaw: '',
      lastDataTime: Date.now(),
      maxBufferLines: 2000,
    };

    ptyProcess.onData((data: string) => {
      instance.lastDataTime = Date.now();

      // Keep rolling raw stream buffer for robust TUI status detection
      instance.rollingRaw = (instance.rollingRaw + data).slice(-30000);

      // Accumulate streaming text into proper lines
      const fullChunk = instance.currentLine + data;
      const parts = fullChunk.split(/\r?\n/);
      instance.currentLine = parts.pop() || '';

      for (const line of parts) {
        instance.buffer.push(line);
        if (instance.buffer.length > instance.maxBufferLines) {
          instance.buffer.shift();
        }
      }

      if (this.onDataEmitter) {
        this.onDataEmitter(sessionId, data);
      }
    });

    this.pties.set(sessionId, instance);
    return instance;
  }

  public write(sessionId: string, data: string): void {
    const instance = this.pties.get(sessionId);
    if (instance) {
      instance.process.write(data);
    }
  }

  public resize(sessionId: string, cols: number, rows: number): void {
    const instance = this.pties.get(sessionId);
    if (instance) {
      // Avoid triggering full ConPTY screen buffer repaints if dimensions have not changed
      if (instance.cols === cols && instance.rows === rows) {
        return;
      }
      instance.cols = cols;
      instance.rows = rows;
      try {
        instance.process.resize(cols, rows);
      } catch (e) {
        // Ignore resize errors if pty is exiting
      }
    }
  }

  public getRecentRaw(sessionId: string): string {
    const instance = this.pties.get(sessionId);
    return instance ? instance.rollingRaw : '';
  }

  public getLastDataTime(sessionId: string): number {
    const instance = this.pties.get(sessionId);
    return instance ? instance.lastDataTime : 0;
  }

  public getText(sessionId: string, linesCount = 100): string {
    const instance = this.pties.get(sessionId);
    if (!instance) return '';
    const lines = [...instance.buffer.slice(-linesCount)];
    if (instance.currentLine) {
      lines.push(instance.currentLine);
    }
    return lines.join('\n');
  }

  public kill(sessionId: string): void {
    const instance = this.pties.get(sessionId);
    if (instance) {
      try {
        instance.process.kill();
      } catch (e) {
        // Ignore kill errors
      }
      this.pties.delete(sessionId);
    }
  }

  public killAll(): void {
    for (const [id] of this.pties) {
      this.kill(id);
    }
  }
}
