import React, { useState, useEffect, useRef } from 'react';
import { Search, Terminal, Folder, Layers, Columns, RotateCcw, Palette, Filter } from 'lucide-react';
import { AppState } from '../../shared/types.js';

interface CommandPaletteProps {
  isOpen: boolean;
  appState: AppState;
  pickerData?: {
    id: string;
    title?: string;
    items: Array<{ id: string; label: string; detail?: string }>;
    allowFreeText?: boolean;
  } | null;
  onClose: () => void;
  onSelectAction?: (action: string, payload?: any) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  appState,
  pickerData,
  onClose,
  onSelectAction,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Build items list
  let items: Array<{
    id: string;
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    category?: string;
    action: () => void;
  }> = [];

  if (pickerData) {
    // Mode: Dedicated Picker (e.g. from tg pick)
    items = pickerData.items.map((item) => ({
      id: item.id,
      title: item.label,
      subtitle: item.detail,
      icon: <Terminal size={15} color="#3b82f6" />,
      action: () => {
        window.electronAPI.submitPicker(pickerData.id, item.id);
        onClose();
      },
    }));

    if (pickerData.allowFreeText && query.trim() && !items.some((i) => i.title === query.trim())) {
      items.unshift({
        id: query.trim(),
        title: query.trim(),
        subtitle: 'Custom input',
        icon: <Search size={15} color="#10b981" />,
        action: () => {
          window.electronAPI.submitPicker(pickerData.id, query.trim());
          onClose();
        },
      });
    }
  } else {
    // Mode: Global Command Palette (Ctrl+P)
    // 1. Sessions across all workspaces
    const sessionItems = Object.values(appState.sessions).map((s) => {
      const ws = appState.workspaces.find((w) => w.id === s.workspaceId);
      return {
        id: `session-${s.id}`,
        title: s.customName || s.name,
        subtitle: `${ws ? ws.name + ' • ' : ''}${s.currentCwd}`,
        icon: <Terminal size={15} color="#60a5fa" />,
        category: 'Sessions',
        action: () => {
          window.electronAPI.selectSession(s.id);
          onClose();
        },
      };
    });

    // 2. Built-in Commands
    const commandItems = [
      {
        id: 'cmd-split',
        title: 'Split Pane (Toggle Left / Right)',
        subtitle: 'Ctrl + D',
        icon: <Columns size={15} color="#fbbf24" />,
        category: 'Commands',
        action: () => {
          if (appState.activeSessionId) {
            window.electronAPI.toggleSplit(appState.activeSessionId);
          }
          onClose();
        },
      },
      {
        id: 'cmd-new-session',
        title: 'New Session (Home Directory)',
        subtitle: 'Ctrl + T',
        icon: <Terminal size={15} color="#3b82f6" />,
        category: 'Commands',
        action: () => {
          window.electronAPI.createSession({ workspaceId: appState.activeWorkspaceId });
          onClose();
        },
      },
      {
        id: 'cmd-open-dir',
        title: 'Open Directory as New Session...',
        subtitle: 'Select folder dialog',
        icon: <Folder size={15} color="#f59e0b" />,
        category: 'Commands',
        action: async () => {
          const dir = await window.electronAPI.openDirectoryDialog();
          if (dir) {
            window.electronAPI.createSession({ workspaceId: appState.activeWorkspaceId, cwd: dir });
          }
          onClose();
        },
      },
      {
        id: 'cmd-new-workspace',
        title: 'Create New Workspace',
        subtitle: 'New project workspace',
        icon: <Layers size={15} color="#ec4899" />,
        category: 'Commands',
        action: () => {
          window.electronAPI.createWorkspace('New Workspace');
          onClose();
        },
      },
      {
        id: 'cmd-undo-close',
        title: 'Undo Close Session (Reopen Last Tab)',
        subtitle: 'Ctrl + Shift + T',
        icon: <RotateCcw size={15} color="#22d3ee" />,
        category: 'Commands',
        action: () => {
          window.electronAPI.undoCloseSession();
          onClose();
        },
      },
      // Themes
      {
        id: 'cmd-theme-campbell',
        title: 'Theme: Windows Terminal (Campbell)',
        subtitle: 'Default Dark',
        icon: <Palette size={15} color="#818cf8" />,
        category: 'Themes',
        action: () => {
          window.electronAPI.setTheme('campbell');
          onClose();
        },
      },
      {
        id: 'cmd-theme-onedark',
        title: 'Theme: One Dark',
        subtitle: 'Atom / VS Code Theme',
        icon: <Palette size={15} color="#818cf8" />,
        category: 'Themes',
        action: () => {
          window.electronAPI.setTheme('oneDark');
          onClose();
        },
      },
      {
        id: 'cmd-theme-dracula',
        title: 'Theme: Dracula',
        subtitle: 'High contrast purple theme',
        icon: <Palette size={15} color="#818cf8" />,
        category: 'Themes',
        action: () => {
          window.electronAPI.setTheme('dracula');
          onClose();
        },
      },
      {
        id: 'cmd-theme-nord',
        title: 'Theme: Nord',
        subtitle: 'Arctic ice blue theme',
        icon: <Palette size={15} color="#818cf8" />,
        category: 'Themes',
        action: () => {
          window.electronAPI.setTheme('nord');
          onClose();
        },
      },
    ];

    items = [...sessionItems, ...commandItems];
  }

  // Filter items by query
  const filtered = items.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return item.title.toLowerCase().includes(q) || (item.subtitle && item.subtitle.toLowerCase().includes(q));
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (pickerData) {
        window.electronAPI.cancelPicker(pickerData.id);
      }
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'center',
        paddingTop: '80px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (pickerData) window.electronAPI.cancelPicker(pickerData.id);
          onClose();
        }
      }}
    >
      <div
        style={{
          width: '580px',
          maxHeight: '440px',
          backgroundColor: '#18181b',
          border: '1px solid #27272a',
          borderRadius: '10px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Search Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #27272a',
            gap: '10px',
          }}
        >
          <Search size={18} color="#71717a" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={pickerData ? pickerData.title || 'Select option...' : 'Type a command or search sessions...'}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f4f4f5',
              fontSize: '14px',
              fontFamily: 'inherit',
            }}
          />
          <span
            style={{
              fontSize: '11px',
              backgroundColor: '#27272a',
              color: '#a1a1aa',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            ESC to close
          </span>
        </div>

        {/* Results List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#71717a', fontSize: '13px' }}>
              No matches found
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: isSelected ? '#27272a' : 'transparent',
                    cursor: 'pointer',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    {item.icon}
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: '13px', color: '#f4f4f5', fontWeight: 500 }}>{item.title}</span>
                      {item.subtitle && (
                        <span
                          style={{
                            fontSize: '11px',
                            color: '#a1a1aa',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </div>
                  {item.category && (
                    <span style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {item.category}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
