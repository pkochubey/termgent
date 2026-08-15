import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { OverlayConfig } from '../../shared/types';
import { X } from 'lucide-react';

interface OverlayModalProps {
  overlay: OverlayConfig;
  onClose: () => void;
}

export const OverlayModal: React.FC<OverlayModalProps> = ({ overlay, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      theme: { background: '#121215' },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    term.writeln(`\x1b[33mRunning overlay command: ${overlay.command}\x1b[0m\n`);

    return () => {
      term.dispose();
    };
  }, [overlay]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '80%',
          height: '70%',
          backgroundColor: '#121215',
          border: '1px solid #3f3f46',
          borderRadius: '8px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Overlay Titlebar */}
        <div
          style={{
            padding: '8px 14px',
            backgroundColor: '#18181b',
            borderBottom: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px',
            fontWeight: 500,
            color: '#e4e4e7',
          }}
        >
          <span>Overlay: {overlay.command}</span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Terminal Container */}
        <div ref={containerRef} style={{ flex: 1, padding: '8px' }} />
      </div>
    </div>
  );
};
