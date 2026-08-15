import React, { useState, useRef } from 'react';
import { Session } from '../../shared/types.js';
import { TerminalPane } from './TerminalPane.js';
import { ReviewPanel } from './ReviewPanel.js';

interface TerminalViewProps {
  session: Session;
  isActive: boolean;
  themeName?: string;
}

export const TerminalView: React.FC<TerminalViewProps> = ({ session, isActive, themeName = 'campbell' }) => {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isReviewOpen = !!session.isReviewOpen;
  const hasSplit = !!session.hasSplit && !isReviewOpen;
  const showRightPane = hasSplit || isReviewOpen;
  const splitRatio = session.splitRatio || 0.5;
  const focusedPane = session.splitFocused || 'left';

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newRatio = (moveEvent.clientX - rect.left) / rect.width;
      const clamped = Math.max(0.15, Math.min(0.85, newRatio));
      (window as any).electronAPI.resizeSplit(session.id, clamped);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleDoubleClick = () => {
    (window as any).electronAPI.resizeSplit(session.id, 0.5);
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: isActive ? 'flex' : 'none',
        backgroundColor: '#09090b',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        userSelect: isDragging ? 'none' : 'auto',
      }}
    >
      {/* Left / Primary Terminal Pane */}
      <div
        style={{
          width: showRightPane ? `calc(${splitRatio * 100}% - 2px)` : '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <TerminalPane
          ptyId={session.id}
          isActive={isActive}
          isFocused={!showRightPane || focusedPane === 'left'}
          themeName={themeName}
          onFocus={() => {
            if (showRightPane && focusedPane !== 'left') {
              (window as any).electronAPI.focusSplit(session.id, 'left');
            }
          }}
        />
      </div>

      {/* Splitter Divider */}
      {showRightPane && (
        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          title="Drag to resize, double-click to center 50/50"
          style={{
            width: '4px',
            height: '100%',
            backgroundColor: isDragging ? '#3b82f6' : '#27272a',
            cursor: 'col-resize',
            zIndex: 10,
            transition: isDragging ? 'none' : 'background-color 0.15s ease',
            position: 'relative',
            flexShrink: 0,
          }}
        />
      )}

      {/* Right Pane: Review Diff Viewer OR Secondary Split Terminal */}
      {showRightPane && (
        <div
          style={{
            width: `calc(${(1 - splitRatio) * 100}% - 2px)`,
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {isReviewOpen ? (
            <ReviewPanel
              cwd={session.currentCwd}
              onClose={() => (window as any).electronAPI.toggleReview(session.id)}
            />
          ) : (
            <TerminalPane
              ptyId={`${session.id}:split`}
              isActive={isActive}
              isFocused={focusedPane === 'right'}
              themeName={themeName}
              onFocus={() => {
                if (focusedPane !== 'right') {
                  (window as any).electronAPI.focusSplit(session.id, 'right');
                }
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};
