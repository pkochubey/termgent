import { AppStore } from './store.js';
import { PtyManager } from './pty.js';
import { Notification } from 'electron';
import path from 'path';

function stripAnsi(str: string): string {
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

/**
 * ApprovalDetector detects interactive stdin permission prompts (Qwen, Codex, AGY, Claude)
 * setting status to 'blocked' (🟡 Yellow dot) and reverting to 'active' (🔵 Blue dot)
 * as soon as the user approves or the prompt is answered.
 */
export class ApprovalDetector {
  private store: AppStore;
  private ptyManager: PtyManager;
  private intervalId: NodeJS.Timeout | null = null;
  private notifiedBlocked = new Set<string>();

  constructor(store: AppStore, ptyManager: PtyManager) {
    this.store = store;
    this.ptyManager = ptyManager;
  }

  public start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.checkSessions(), 600);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private checkSessions(): void {
    const state = this.store.getState();

    for (const [sessionId, session] of Object.entries(state.sessions)) {
      // Don't evaluate if the session was explicitly marked completed by a hook
      if (session.status === 'completed') {
        this.notifiedBlocked.delete(sessionId);
        continue;
      }

      const rawText = this.ptyManager.getRecentRaw(sessionId) || this.ptyManager.getText(sessionId, 40);
      if (!rawText) continue;

      const clean = stripAnsi(rawText);
      const lines = clean.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length === 0) continue;

      const tailLines = lines.slice(-20);
      const tail = tailLines.join(' \n ').toLowerCase();

      // Check if session is actively streaming or thinking (e.g. AGY/Qwen/Codex spinners)
      const hasWorkingIndicator =
        tail.includes('working...') ||
        tail.includes('thinking...') ||
        tail.includes('examining ') ||
        tail.includes('analyzing ') ||
        tail.includes('running ');

      // An approval dialog MUST have an interactive numbered selection or explicit prompt question
      const hasInteractiveNumberedChoice = lines.slice(-8).some((l) => {
        const lower = l.toLowerCase().trim();
        return (
          // AGY / Codex / Qwen selection cursor
          (lower.startsWith('> 1.') || lower.startsWith('1.')) &&
          (lower.includes('yes') || lower.includes('да') || lower.includes('allow') || lower.includes('proceed') || lower.includes('разрешить'))
        );
      });

      const hasExplicitApprovalQuestion = lines.slice(-12).some((l) => {
        const lower = l.toLowerCase().trim();
        return (
          lower.includes('allow creation of this file') ||
          lower.includes('allow execution of') ||
          lower.includes('allow modification of') ||
          lower.includes('allow reading of') ||
          lower.includes('allow access') ||
          lower.includes('would you like to run the following command') ||
          lower.includes('do you want to proceed?') ||
          lower.includes('ожидание подтверждения от пользователя') ||
          lower.includes('разрешить выполнение') ||
          lower.includes('requesting permission for:')
        );
      });

      const hasBinaryPrompt = lines.slice(-5).some((l) => {
        const lower = l.toLowerCase().trim();
        return (
          lower.includes('[y/n]') ||
          lower.includes('(y/n)') ||
          lower.includes('[y/n]?') ||
          lower.includes('(y/n)?') ||
          lower.includes('[yes/no]') ||
          lower.includes('(yes/no)')
        );
      });

      // Session is blocked ONLY when there is an active interactive choice or question
      const isBlocked = hasInteractiveNumberedChoice || hasBinaryPrompt || (hasExplicitApprovalQuestion && !hasWorkingIndicator);

      if (isBlocked) {
        if (session.status !== 'blocked') {
          this.store.setSessionStatus(sessionId, 'blocked');
          if (!this.notifiedBlocked.has(sessionId)) {
            this.notifiedBlocked.add(sessionId);
            this.sendNotification(session.customName || session.name, 'Action requires user approval (y/n)');
          }
        }
      } else {
        this.notifiedBlocked.delete(sessionId);
        // If it was blocked and the user answered the prompt or agent resumed working, revert back to active
        if (session.status === 'blocked') {
          this.store.setSessionStatus(sessionId, 'active');
        }
      }
    }
  }

  private sendNotification(title: string, body: string): void {
    try {
      if (Notification.isSupported()) {
        const iconPath = path.join(__dirname, '../../build/icon.png');
        const notif = new Notification({
          title: `Termgent: ${title}`,
          body,
          icon: iconPath,
          silent: false,
        });
        notif.show();
      }
    } catch (e) {
      console.warn('[ApprovalDetector Notification Error]', e);
    }
  }
}
