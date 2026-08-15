export type SessionStatus = 'idle' | 'active' | 'blocked' | 'completed';
export type AgentType = 'antigravity' | 'codex' | 'copilot' | 'qwen' | 'claude' | 'custom';

export interface GitStatus {
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  dirty: number;
  worktree?: string;
}

export interface GitDiffLine {
  type: 'add' | 'delete' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface GitDiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: GitDiffLine[];
}

export interface GitDiffFile {
  filePath: string;
  oldPath?: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  hunks: GitDiffHunk[];
  isBinary?: boolean;
}

export interface GitDiffResult {
  cwd: string;
  branch: string;
  totalAdditions: number;
  totalDeletions: number;
  files: GitDiffFile[];
}

export interface Session {
  id: string;
  workspaceId: string;
  name: string;
  customName?: string;
  initialCwd: string;
  currentCwd: string;
  status: SessionStatus;
  agentType?: AgentType;
  gitStatus?: GitStatus;
  hasSplit?: boolean;
  isReviewOpen?: boolean;
  splitRatio?: number; // default 0.5
  splitFocused?: 'left' | 'right';
  splitCwd?: string;
  restoreCommand?: string;
}

export interface Workspace {
  id: string;
  name: string;
  sessionIds: string[];
  isFocused?: boolean;
  isCollapsed?: boolean;
}

export interface HudConfig {
  sessionId: string;
  message: string;
  detail?: string;
  spinner?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center' | 'top' | 'bottom';
}

export interface PickerItem {
  id: string;
  label: string;
  detail?: string;
}

export interface PickerState {
  id: string;
  title?: string;
  query?: string;
  items: PickerItem[];
  allowFreeText?: boolean;
}

export interface LocalLlmInfo {
  available: boolean;
  provider: 'ollama' | 'vllm' | 'lmstudio' | 'none';
  models: string[];
}

export interface AppState {
  workspaces: Workspace[];
  sessions: Record<string, Session>;
  activeWorkspaceId: string;
  activeSessionId: string | null;
  focusedWorkspaceIds?: string[];
  hud?: Record<string, HudConfig | null>;
  theme?: string;
  localLlm?: LocalLlmInfo;
}

export interface OverlayConfig {
  id: string;
  sessionId: string;
  command: string;
  args: string[];
  cwd?: string;
  floating?: boolean;
}

// IPC Channel definitions between Electron Main and Renderer
export const IPC_CHANNELS = {
  STATE_GET: 'state:get',
  STATE_UPDATED: 'state:updated',
  WORKSPACE_CREATE: 'workspace:create',
  WORKSPACE_SELECT: 'workspace:select',
  WORKSPACE_RENAME: 'workspace:rename',
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_TOGGLE_FOCUS: 'workspace:toggle-focus',
  WORKSPACE_FILTER_CLEAR: 'workspace:filter-clear',
  WORKSPACE_TOGGLE_COLLAPSE: 'workspace:toggle-collapse',
  SESSION_CREATE: 'session:create',
  SESSION_SELECT: 'session:select',
  SESSION_RENAME: 'session:rename',
  SESSION_CLOSE: 'session:close',
  SESSION_UNDO_CLOSE: 'session:undo-close',
  SESSION_SET_STATUS: 'session:set-status',
  SESSION_SPLIT_TOGGLE: 'session:split-toggle',
  SESSION_SPLIT_FOCUS: 'session:split-focus',
  SESSION_SPLIT_RESIZE: 'session:split-resize',
  PTY_INPUT: 'pty:input',
  PTY_OUTPUT: 'pty:output',
  PTY_RESIZE: 'pty:resize',
  PTY_ATTACH: 'pty:attach',
  PTY_PWD_CHANGED: 'pty:pwd-changed',
  OVERLAY_START: 'overlay:start',
  OVERLAY_CLOSE: 'overlay:close',
  HUD_SET: 'hud:set',
  HUD_CLOSE: 'hud:close',
  PICKER_SHOW: 'picker:show',
  PICKER_SUBMIT: 'picker:submit',
  PICKER_CANCEL: 'picker:cancel',
  OPEN_SCRATCH: 'scratch:toggle',
  OPEN_DIRECTORY_DIALOG: 'dialog:open-directory',
  THEME_SET: 'theme:set',
  AGENT_START: 'agent:start',
  AGENT_LOCAL_STATUS: 'agent:local-status',
  SESSION_REVIEW_TOGGLE: 'session:review-toggle',
  GIT_GET_DIFF: 'git:get-diff',
};
