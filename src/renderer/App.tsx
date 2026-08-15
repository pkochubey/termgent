import React, { useEffect, useState, useRef } from 'react';
import { AppState, OverlayConfig } from '../shared/types.js';
import { Sidebar } from './components/Sidebar.js';
import { TerminalView } from './components/TerminalView.js';
import { OverlayModal } from './components/OverlayModal.js';
import { StatusBadge } from './components/StatusBadge.js';
import { CommandPalette } from './components/CommandPalette.js';
import { HudOverlay } from './components/HudOverlay.js';
import { MruSwitcher } from './components/MruSwitcher.js';
import {
  GitBranch,
  Terminal as TerminalIcon,
  Columns,
  Search,
  RotateCcw,
  Bot,
  Zap,
  FileCode,
} from 'lucide-react';

export const App: React.FC = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [activeOverlay, setActiveOverlay] = useState<OverlayConfig | null>(null);
  const [pickerData, setPickerData] = useState<any | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState<boolean>(false);

  // MRU Session History
  const [mruHistory, setMruHistory] = useState<string[]>([]);
  const [isMruOpen, setIsMruOpen] = useState<boolean>(false);
  const [mruIndex, setMruIndex] = useState<number>(0);

  const stateRef = useRef<AppState | null>(null);
  const isMruOpenRef = useRef<boolean>(false);
  const mruIndexRef = useRef<number>(0);
  const mruHistoryRef = useRef<string[]>([]);

  stateRef.current = state;
  isMruOpenRef.current = isMruOpen;
  mruIndexRef.current = mruIndex;
  mruHistoryRef.current = mruHistory;

  // Compute full MRU session list: tracked MRU order first, then any other existing sessions in state
  const getFullMruList = (s: AppState | null, history: string[]): string[] => {
    if (!s || !s.sessions) return [];
    const allIds = Object.keys(s.sessions);
    const validHistory = history.filter((id) => s.sessions[id]);
    const remaining = allIds.filter((id) => !validHistory.includes(id));
    return [...validHistory, ...remaining];
  };

  useEffect(() => {
    if (!window.electronAPI) {
      console.error('[Termgent App] window.electronAPI is undefined!');
      return;
    }

    window.electronAPI
      .getState()
      .then((s: AppState) => {
        setState(s);
        const allIds = Object.keys(s.sessions || {});
        if (s.activeSessionId) {
          const initial = [s.activeSessionId, ...allIds.filter((id) => id !== s.activeSessionId)];
          setMruHistory(initial);
          mruHistoryRef.current = initial;
        } else {
          setMruHistory(allIds);
          mruHistoryRef.current = allIds;
        }
      })
      .catch((err: any) => console.error('[Termgent App] Error loading state:', err));

    const removeStateListener = window.electronAPI.onStateUpdated((newState: AppState) => {
      setState(newState);
      const allIds = Object.keys(newState.sessions || {});
      if (newState.activeSessionId && !isMruOpenRef.current) {
        setMruHistory((prev) => {
          const valid = prev.filter((id) => newState.sessions[id] && id !== newState.activeSessionId);
          const remaining = allIds.filter((id) => id !== newState.activeSessionId && !valid.includes(id));
          const updated = [newState.activeSessionId!, ...valid, ...remaining];
          mruHistoryRef.current = updated;
          return updated;
        });
      }
    });

    const removeOverlayListener = window.electronAPI.onOverlayStart((overlay: any) => {
      setActiveOverlay(overlay);
    });

    const removePickerListener = window.electronAPI.onPickerShow((picker: any) => {
      setPickerData(picker);
      setIsPaletteOpen(true);
    });

    // Global Key Listener for shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + P -> Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && !e.shiftKey) {
        e.preventDefault();
        setPickerData(null);
        setIsPaletteOpen((prev) => !prev);
        return;
      }

      // Ctrl + D -> Split Pane
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && !e.shiftKey) {
        e.preventDefault();
        if (stateRef.current?.activeSessionId) {
          window.electronAPI.toggleSplit(stateRef.current.activeSessionId);
        }
        return;
      }

      // Ctrl + Shift + T -> Undo Close
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        window.electronAPI.undoCloseSession();
        return;
      }

      // Ctrl + Shift + R -> Toggle Git Diff Review
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (stateRef.current?.activeSessionId) {
          (window as any).electronAPI.toggleReview(stateRef.current.activeSessionId);
        }
        return;
      }

      // Ctrl + Tab -> MRU Switcher
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        const list = getFullMruList(stateRef.current, mruHistoryRef.current);
        if (list.length <= 1) return;

        if (!isMruOpenRef.current) {
          setIsMruOpen(true);
          // First press jumps from current tab (0) to previous tab (1)
          const nextIdx = e.shiftKey ? list.length - 1 : 1;
          setMruIndex(nextIdx);
          mruIndexRef.current = nextIdx;
        } else {
          // Subsequent presses cycle through the list
          const delta = e.shiftKey ? -1 : 1;
          const nextIdx = (mruIndexRef.current + delta + list.length) % list.length;
          setMruIndex(nextIdx);
          mruIndexRef.current = nextIdx;
        }
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || (!e.ctrlKey && isMruOpenRef.current)) {
        if (isMruOpenRef.current) {
          setIsMruOpen(false);
          const list = getFullMruList(stateRef.current, mruHistoryRef.current);
          if (list.length > 0) {
            const targetId = list[mruIndexRef.current % list.length];
            if (targetId && targetId !== stateRef.current?.activeSessionId) {
              window.electronAPI.selectSession(targetId);
            }
          }
          setMruIndex(0);
          mruIndexRef.current = 0;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      removeStateListener?.();
      removeOverlayListener?.();
      removePickerListener?.();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  if (!state) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#09090b',
          color: '#71717a',
          fontFamily: 'Segoe UI, sans-serif',
        }}
      >
        Loading Termgent...
      </div>
    );
  }

  const activeSession = state.activeSessionId ? state.sessions[state.activeSessionId] : null;
  const activeHud = activeSession && state.hud ? state.hud[activeSession.id] : null;

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      }}
    >
      {/* Sidebar */}
      <Sidebar
        state={state}
        onSelectWorkspace={(id) => window.electronAPI.selectWorkspace(id)}
        onCreateWorkspace={(name) => window.electronAPI.createWorkspace(name)}
        onRenameWorkspace={(id, name) => window.electronAPI.renameWorkspace(id, name)}
        onDeleteWorkspace={(id) => window.electronAPI.deleteWorkspace(id)}
        onSelectSession={(id) => window.electronAPI.selectSession(id)}
        onCreateSession={(wsId) => window.electronAPI.createSession({ workspaceId: wsId })}
        onCreateSessionInFolder={async (wsId) => {
          const folder = await window.electronAPI.openDirectoryDialog();
          if (folder) {
            window.electronAPI.createSession({ workspaceId: wsId, cwd: folder });
          }
        }}
        onRenameSession={(id, name) => window.electronAPI.renameSession(id, name)}
        onCloseSession={(id) => window.electronAPI.closeSession(id)}
        onToggleSplit={(id) => window.electronAPI.toggleSplit(id)}
      />

      {/* Main Terminal View Container */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
        {/* Title / Header Bar */}
        <div
          style={{
            height: '35px',
            backgroundColor: '#18181b',
            borderBottom: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: '12px',
            paddingRight: '140px', // Reserve space for Windows system title controls
            fontSize: '12px',
            color: '#a1a1aa',
            gap: '8px',
            WebkitAppRegion: 'drag',
          } as React.CSSProperties}
        >
          {activeSession ? (
            <>
              <StatusBadge status={activeSession.status} />
              <TerminalIcon size={14} style={{ color: '#3b82f6' }} />
              <span style={{ fontWeight: 600, color: '#f4f4f5' }}>{activeSession.customName || activeSession.name}</span>
              <span style={{ color: '#52525b' }}>—</span>
              <span style={{ color: '#71717a', fontSize: '11px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeSession.currentCwd}
              </span>

              {activeSession.gitStatus && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: '#27272a',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#e4e4e7',
                    WebkitAppRegion: 'no-drag',
                  } as React.CSSProperties}
                >
                  <GitBranch size={12} />
                  <span>{activeSession.gitStatus.branch}</span>
                  {activeSession.gitStatus.dirty > 0 && (
                    <span style={{ color: '#fbbf24' }}>*{activeSession.gitStatus.dirty}</span>
                  )}
                </div>
              )}
            </>
          ) : (
            <span>No active session</span>
          )}

          {/* Quick Header Tool Buttons */}
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}
          >
            {/* Review Git Changes Button */}
            <button
              onClick={() => {
                if (activeSession) (window as any).electronAPI.toggleReview(activeSession.id);
              }}
              title="Review Git Changes in Split View (Ctrl + Shift + R)"
              style={{
                backgroundColor: activeSession?.isReviewOpen
                  ? 'rgba(59, 130, 246, 0.2)'
                  : activeSession?.gitStatus?.dirty
                  ? 'rgba(251, 191, 36, 0.12)'
                  : 'transparent',
                border: activeSession?.isReviewOpen
                  ? '1px solid #3b82f6'
                  : activeSession?.gitStatus?.dirty
                  ? '1px solid rgba(251, 191, 36, 0.3)'
                  : '1px solid transparent',
                color: activeSession?.isReviewOpen
                  ? '#60a5fa'
                  : activeSession?.gitStatus?.dirty
                  ? '#fbbf24'
                  : '#a1a1aa',
                cursor: 'pointer',
                padding: '3px 8px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
            >
              <FileCode size={13} />
              <span>Review</span>
              {activeSession?.gitStatus?.dirty ? (
                <span
                  style={{
                    backgroundColor: '#fbbf24',
                    color: '#09090b',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '0 4px',
                    borderRadius: '10px',
                    marginLeft: '2px',
                  }}
                >
                  {activeSession.gitStatus.dirty}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => setIsPaletteOpen(true)}
              title="Command Palette (Ctrl + P)"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#a1a1aa',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Search size={14} />
            </button>

            <button
              onClick={() => {
                if (activeSession) window.electronAPI.toggleSplit(activeSession.id);
              }}
              title="Toggle Split Pane (Ctrl + D)"
              style={{
                backgroundColor: activeSession?.hasSplit ? '#27272a' : 'transparent',
                border: 'none',
                color: activeSession?.hasSplit ? '#fbbf24' : '#a1a1aa',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Columns size={14} />
            </button>

            <button
              onClick={() => window.electronAPI.undoCloseSession()}
              title="Undo Close Session (Ctrl + Shift + T)"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#71717a',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>

        {/* Terminal Canvas Deck */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {Object.values(state.sessions).map((session) => (
            <TerminalView
              key={session.id}
              session={session}
              isActive={session.id === state.activeSessionId}
              themeName={state.theme}
            />
          ))}

          {/* Floating HUD Indicator */}
          {activeHud && (
            <HudOverlay
              config={activeHud}
              onClose={() => {
                if (activeSession) window.electronAPI.closeSessionHud(activeSession.id);
              }}
            />
          )}
        </div>
      </div>

      {/* Floating Overlay Modal */}
      {activeOverlay && (
        <OverlayModal overlay={activeOverlay} onClose={() => setActiveOverlay(null)} />
      )}

      {/* Unified Command Palette & Fuzzy Picker Modal */}
      <CommandPalette
        isOpen={isPaletteOpen}
        appState={state}
        pickerData={pickerData}
        onClose={() => {
          setIsPaletteOpen(false);
          setPickerData(null);
        }}
      />

      {/* Ctrl+Tab MRU Switcher */}
      <MruSwitcher
        isOpen={isMruOpen}
        appState={state}
        mruSessionIds={getFullMruList(state, mruHistory)}
        selectedIndex={mruIndex}
      />
    </div>
  );
};
