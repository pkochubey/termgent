import React, { useState } from 'react';
import { AppState, Session } from '../../shared/types.js';
import { StatusBadge } from './StatusBadge.js';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Terminal,
  FolderPlus,
  FolderOpen,
  X,
  GitBranch,
  Edit2,
  Trash2,
  Columns,
  Play,
} from 'lucide-react';

interface SidebarProps {
  state: AppState;
  onSelectWorkspace: (id: string) => void;
  onCreateWorkspace: (name: string) => void;
  onRenameWorkspace: (id: string, name: string) => void;
  onDeleteWorkspace: (id: string) => void;
  onSelectSession: (id: string) => void;
  onCreateSession: (workspaceId: string) => void;
  onCreateSessionInFolder: (workspaceId: string) => void;
  onRenameSession: (id: string, name: string) => void;
  onCloseSession: (id: string) => void;
  onToggleSplit?: (sessionId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  state,
  onSelectWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onSelectSession,
  onCreateSession,
  onCreateSessionInFolder,
  onRenameSession,
  onCloseSession,
  onToggleSplit,
}) => {
  const [collapsedWs, setCollapsedWs] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedWs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const startRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditValue(currentName);
  };

  const commitRename = (id: string, isWorkspace: boolean) => {
    if (editValue.trim()) {
      if (isWorkspace) {
        onRenameWorkspace(id, editValue.trim());
      } else {
        onRenameSession(id, editValue.trim());
      }
    }
    setEditingId(null);
  };

  const handleCreateWorkspace = () => {
    const nextNum = state.workspaces.length + 1;
    const name = `workspace-${nextNum}`;
    onCreateWorkspace(name);
  };

  return (
    <div
      style={{
        width: '260px',
        backgroundColor: '#121215',
        borderRight: '1px solid #27272a',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Sidebar Header */}
      <div
        style={{
          height: '35px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          borderBottom: '1px solid #1f1f23',
          fontSize: '12px',
          fontWeight: 600,
          color: '#a1a1aa',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          WebkitAppRegion: 'drag',
        } as React.CSSProperties}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Workspaces</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={handleCreateWorkspace}
            title="New Workspace"
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
            <FolderPlus size={15} />
          </button>
        </div>
      </div>

      {/* Workspaces List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {state.workspaces.map((ws) => {
          const isWsActive = state.activeWorkspaceId === ws.id;
          const isCollapsed = !!collapsedWs[ws.id];
          const isEditing = editingId === ws.id;

          return (
            <div key={ws.id} style={{ marginBottom: '8px' }}>
              {/* Workspace Header Row */}
              <div
                onClick={() => onSelectWorkspace(ws.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  color: isWsActive ? '#f4f4f5' : '#a1a1aa',
                  fontWeight: 600,
                  fontSize: '13px',
                  backgroundColor: isWsActive ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                  borderLeft: isWsActive ? '3px solid #3b82f6' : '3px solid transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                  <span
                    onClick={(e) => toggleCollapse(ws.id, e)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                  >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </span>

                  {isEditing ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => commitRename(ws.id, true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(ws.id, true);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        backgroundColor: '#27272a',
                        border: '1px solid #3b82f6',
                        color: '#f4f4f5',
                        borderRadius: '3px',
                        fontSize: '12px',
                        padding: '1px 4px',
                        outline: 'none',
                        width: '100px',
                      }}
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => startRename(ws.id, ws.name, e)}
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ws.name}
                    </span>
                  )}
                </div>

                {/* Workspace Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>

                  <button
                    onClick={(e) => startRename(ws.id, ws.name, e)}
                    title="Rename Workspace"
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#71717a',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Edit2 size={12} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateSessionInFolder(ws.id);
                    }}
                    title="Open Directory in this Workspace"
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#71717a',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <FolderOpen size={12} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateSession(ws.id);
                    }}
                    title="New Session"
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#71717a',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Plus size={13} />
                  </button>

                  {state.workspaces.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteWorkspace(ws.id);
                      }}
                      title="Delete Workspace"
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#71717a',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        borderRadius: '3px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Workspace Sessions */}
              {!isCollapsed && (
                <div style={{ marginLeft: '12px', borderLeft: '1px solid #1f1f23', paddingLeft: '4px' }}>
                  {ws.sessionIds.map((sid) => {
                    const session = state.sessions[sid];
                    if (!session) return null;

                    const isSessionActive = state.activeSessionId === sid;
                    const isSessionEditing = editingId === sid;

                    return (
                      <div
                        key={session.id}
                        onClick={() => onSelectSession(session.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '5px 8px',
                          margin: '2px 4px 2px 0',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          backgroundColor: isSessionActive
                            ? '#27272a'
                            : session.status === 'active'
                            ? 'rgba(56, 189, 248, 0.08)'
                            : session.status === 'blocked'
                            ? 'rgba(245, 158, 11, 0.1)'
                            : session.status === 'completed'
                            ? 'rgba(16, 185, 129, 0.08)'
                            : 'transparent',
                          color: isSessionActive ? '#f4f4f5' : '#a1a1aa',
                          fontSize: '12px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <StatusBadge status={session.status} />

                          {session.agentType && (
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                fontWeight: 600,
                                backgroundColor:
                                  session.agentType === 'antigravity'
                                    ? 'rgba(59, 130, 246, 0.2)'
                                    : session.agentType === 'qwen'
                                    ? 'rgba(168, 85, 247, 0.2)'
                                    : session.agentType === 'codex'
                                    ? 'rgba(161, 161, 170, 0.2)'
                                    : session.agentType === 'copilot'
                                    ? 'rgba(56, 189, 248, 0.2)'
                                    : 'rgba(236, 72, 153, 0.2)',
                                color:
                                  session.agentType === 'antigravity'
                                    ? '#60a5fa'
                                    : session.agentType === 'qwen'
                                    ? '#c084fc'
                                    : session.agentType === 'codex'
                                    ? '#d4d4d8'
                                    : session.agentType === 'copilot'
                                    ? '#38bdf8'
                                    : '#f472b6',
                              }}
                            >
                              {session.agentType === 'antigravity'
                                ? 'AGY'
                                : session.agentType.toUpperCase()}
                            </span>
                          )}

                          {isSessionEditing ? (
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => commitRename(session.id, false)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitRename(session.id, false);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                backgroundColor: '#18181b',
                                border: '1px solid #3b82f6',
                                color: '#f4f4f5',
                                borderRadius: '3px',
                                fontSize: '11px',
                                padding: '1px 4px',
                                outline: 'none',
                                width: '100px',
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                minWidth: 0,
                              }}
                              title={`Folder: ${session.currentCwd}${session.restoreCommand ? `\nLast Command: ${session.restoreCommand}` : ''}`}
                            >
                              <span
                                onDoubleClick={(e) => startRename(session.id, session.customName || session.name, e)}
                                style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  fontWeight: isSessionActive ? 500 : 400,
                                }}
                              >
                                {session.customName || session.name}
                              </span>
                              {session.restoreCommand && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    color: '#71717a',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    lineHeight: '1.1',
                                  }}
                                >
                                  {session.restoreCommand}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Badges & Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          {session.agentType && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectSession(session.id);
                                const cmd = session.agentType === 'antigravity' ? 'agy' : session.agentType;
                                window.electronAPI.sendPtyInput(session.id, `${cmd}\r`);
                              }}
                              title={`Run ${session.agentType === 'antigravity' ? 'Antigravity (agy)' : session.agentType.toUpperCase()} in this terminal`}
                              style={{
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: '#10b981',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <Play size={11} fill="#10b981" color="#10b981" />
                            </button>
                          )}

                          {session.hasSplit && (
                            <span
                              title="Split Pane Active"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                color: '#fbbf24',
                                padding: '1px',
                              }}
                            >
                              <Columns size={11} />
                            </span>
                          )}

                          <button
                            onClick={(e) => startRename(session.id, session.customName || session.name, e)}
                            title="Rename Session"
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: '#71717a',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <Edit2 size={11} />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onCloseSession(session.id);
                            }}
                            title="Close Session"
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: '#71717a',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Controls */}
      <div
        style={{
          borderTop: '1px solid #1f1f23',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#71717a',
        }}
      >
        <span>Ctrl+P: Commands</span>
        <span>Ctrl+D: Split</span>
      </div>
    </div>
  );
};
