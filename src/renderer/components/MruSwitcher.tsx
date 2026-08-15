import React from 'react';
import { AppState, Session } from '../../shared/types.js';
import { StatusBadge } from './StatusBadge.js';
import { Terminal, Folder } from 'lucide-react';

interface MruSwitcherProps {
  isOpen: boolean;
  appState: AppState;
  mruSessionIds: string[];
  selectedIndex: number;
}

export const MruSwitcher: React.FC<MruSwitcherProps> = ({
  isOpen,
  appState,
  mruSessionIds,
  selectedIndex,
}) => {
  if (!isOpen) return null;

  // Filter to valid existing sessions
  const sessions: Session[] = mruSessionIds
    .map((id) => appState.sessions[id])
    .filter((s): s is Session => !!s)
    .slice(0, 8); // top 8

  if (sessions.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: '420px',
          backgroundColor: '#18181b',
          border: '1px solid #27272a',
          borderRadius: '10px',
          padding: '8px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            color: '#71717a',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            padding: '6px 10px',
            fontWeight: 600,
          }}
        >
          Recent Sessions (Ctrl + Tab)
        </div>

        {sessions.map((session, idx) => {
          const isSelected = idx === (selectedIndex % sessions.length);
          const ws = appState.workspaces.find((w) => w.id === session.workspaceId);

          return (
            <div
              key={session.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: isSelected ? '#27272a' : 'transparent',
                border: isSelected ? '1px solid #3b82f6' : '1px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <StatusBadge status={session.status} />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: '13px',
                      color: isSelected ? '#ffffff' : '#f4f4f5',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {session.customName || session.name}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#a1a1aa',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {session.currentCwd}
                  </span>
                </div>
              </div>

              <span
                style={{
                  fontSize: '10px',
                  backgroundColor: '#09090b',
                  color: '#a1a1aa',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                {ws?.name || 'main'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
