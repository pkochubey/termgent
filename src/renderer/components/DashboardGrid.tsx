import React, { useState, useEffect } from 'react';
import { AppState, Session } from '../../shared/types.js';
import { StatusBadge } from './StatusBadge.js';
import { GitBranch, Terminal, X } from 'lucide-react';

interface DashboardGridProps {
  isOpen: boolean;
  appState: AppState;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({
  isOpen,
  appState,
  onClose,
  onSelectSession,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sessionBuffers, setSessionBuffers] = useState<Record<string, string>>({});

  const sessions = Object.values(appState.sessions);

  useEffect(() => {
    if (isOpen) {
      // Find current active session index
      const curIdx = sessions.findIndex((s) => s.id === appState.activeSessionId);
      setSelectedIndex(curIdx >= 0 ? curIdx : 0);

      // Fetch last few lines of buffer for each session preview
      sessions.forEach((s) => {
        window.electronAPI.attachPty(s.id).then((res: any) => {
          if (res && res.buffer) {
            // Keep last 8 lines
            const lines = res.buffer.split('\n').slice(-8).join('\n');
            setSessionBuffers((prev) => ({ ...prev, [s.id]: lines }));
          }
        });
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(sessions.length))));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % sessions.length);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + sessions.length) % sessions.length);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(sessions.length - 1, prev + cols));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(0, prev - cols));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (sessions[selectedIndex]) {
        onSelectSession(sessions[selectedIndex].id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      autoFocus
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(9, 9, 11, 0.94)',
        backdropFilter: 'blur(10px)',
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 32px',
        outline: 'none',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px', fontWeight: 600, color: '#f4f4f5' }}>
            Dashboard Overview
          </span>
          <span
            style={{
              fontSize: '12px',
              backgroundColor: '#27272a',
              color: '#a1a1aa',
              padding: '2px 8px',
              borderRadius: '4px',
            }}
          >
            {sessions.length} sessions active
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: '#71717a' }}>
            Navigate with Arrows • Press Enter to jump • Esc to exit
          </span>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              borderRadius: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Grid Container */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: '16px',
          overflowY: 'auto',
        }}
      >
        {sessions.map((session, idx) => {
          const isSelected = idx === selectedIndex;
          const ws = appState.workspaces.find((w) => w.id === session.workspaceId);
          const bufferText = sessionBuffers[session.id] || '(Session active)';

          return (
            <div
              key={session.id}
              onClick={() => {
                onSelectSession(session.id);
                onClose();
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
              style={{
                backgroundColor: '#18181b',
                border: isSelected ? '2px solid #3b82f6' : '1px solid #27272a',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? '0 0 20px rgba(59, 130, 246, 0.3)' : 'none',
                minHeight: '160px',
                position: 'relative',
              }}
            >
              {/* Card Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <StatusBadge status={session.status} />
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: isSelected ? '#ffffff' : '#f4f4f5',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {session.customName || session.name}
                  </span>
                </div>

                <span
                  style={{
                    fontSize: '11px',
                    backgroundColor: '#27272a',
                    color: '#a1a1aa',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {ws?.name || 'main'}
                </span>
              </div>

              {/* Path & Git */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '11px',
                  color: '#71717a',
                  marginBottom: '10px',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session.currentCwd}
                </span>
                {session.gitStatus && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#60a5fa' }}>
                    <GitBranch size={11} />
                    {session.gitStatus.branch}
                  </span>
                )}
              </div>

              {/* Terminal Preview */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: '#0c0c0e',
                  borderRadius: '4px',
                  padding: '8px',
                  fontFamily: '"Cascadia Mono", Consolas, monospace',
                  fontSize: '11px',
                  color: '#a1a1aa',
                  overflow: 'hidden',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.3',
                  opacity: isSelected ? 1 : 0.8,
                }}
              >
                {bufferText}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
