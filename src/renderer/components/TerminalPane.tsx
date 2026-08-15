import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';

interface TerminalPaneProps {
  ptyId: string;
  isActive: boolean;
  isFocused?: boolean;
  themeName?: string;
  onFocus?: () => void;
}

const THEMES: Record<string, any> = {
  campbell: {
    background: '#0c0c0e',
    foreground: '#cccccc',
    cursor: '#ffffff',
    cursorAccent: '#0c0c0e',
    selectionBackground: 'rgba(255, 255, 255, 0.28)',
    black: '#0c0c0c',
    red: '#c50f1f',
    green: '#13a10e',
    yellow: '#c19c00',
    blue: '#0037da',
    magenta: '#881798',
    cyan: '#3a96dd',
    white: '#cccccc',
    brightBlack: '#767676',
    brightRed: '#e74856',
    brightGreen: '#16c60c',
    brightYellow: '#f9f1a5',
    brightBlue: '#3b78ff',
    brightMagenta: '#b4009e',
    brightCyan: '#61d6d6',
    brightWhite: '#f2f2f2',
  },
  oneDark: {
    background: '#1e1e24',
    foreground: '#abb2bf',
    cursor: '#528bff',
    selectionBackground: '#3e4451',
    black: '#282c34',
    red: '#e06c75',
    green: '#98c379',
    yellow: '#e5c07b',
    blue: '#61afef',
    magenta: '#c678dd',
    cyan: '#56b6c2',
    white: '#abb2bf',
    brightBlack: '#5c6370',
    brightRed: '#e06c75',
    brightGreen: '#98c379',
    brightYellow: '#e5c07b',
    brightBlue: '#61afef',
    brightMagenta: '#c678dd',
    brightCyan: '#56b6c2',
    brightWhite: '#ffffff',
  },
  dracula: {
    background: '#1e1f29',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    selectionBackground: '#44475a',
    black: '#21222c',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
    brightBlack: '#6272a4',
    brightRed: '#ff6e6e',
    brightGreen: '#69ff94',
    brightYellow: '#ffffa5',
    brightBlue: '#d6acff',
    brightMagenta: '#ff92df',
    brightCyan: '#a4ffff',
    brightWhite: '#ffffff',
  },
  nord: {
    background: '#191d24',
    foreground: '#d8dee9',
    cursor: '#d8dee9',
    selectionBackground: '#434c5e',
    black: '#2e3440',
    red: '#bf616a',
    green: '#a3be8c',
    yellow: '#ebcb8b',
    blue: '#81a1c1',
    magenta: '#b48ead',
    cyan: '#88c0d0',
    white: '#e5e9f0',
    brightBlack: '#4c566a',
    brightRed: '#bf616a',
    brightGreen: '#a3be8c',
    brightYellow: '#ebcb8b',
    brightBlue: '#81a1c1',
    brightMagenta: '#b48ead',
    brightCyan: '#8fbcbb',
    brightWhite: '#eceff4',
  },
};

export const TerminalPane: React.FC<TerminalPaneProps> = ({
  ptyId,
  isActive,
  isFocused = true,
  themeName = 'campbell',
  onFocus,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const currentTheme = THEMES[themeName] || THEMES.campbell;

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      fontSize: 14,
      fontFamily: '"Cascadia Mono", "Cascadia Code", Consolas, "Courier New", monospace',
      lineHeight: 1.2,
      letterSpacing: 0,
      scrollback: 10000,
      windowsMode: true,
      scrollOnUserInput: false,
      theme: currentTheme,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new Unicode11Addon());
    term.loadAddon(new WebLinksAddon());

    term.open(containerRef.current);

    // Load GPU-accelerated WebGL text renderer
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      term.loadAddon(webglAddon);
    } catch (e) {}

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Custom Key Handler for Ctrl+C / Ctrl+V
    term.attachCustomKeyEventHandler((e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        if (e.shiftKey || term.hasSelection()) {
          const selectedText = term.getSelection();
          if (selectedText) {
            navigator.clipboard.writeText(selectedText);
            return false;
          }
        }
        return true;
      }

      if (
        ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) ||
        (e.shiftKey && e.key === 'Insert')
      ) {
        if (e.type === 'keydown') {
          navigator.clipboard.readText().then((text) => {
            if (text) {
              window.electronAPI.sendPtyInput(ptyId, text);
            }
          });
        }
        return false;
      }

      return true;
    });

    // Right-Click Context Menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (term.hasSelection()) {
        const text = term.getSelection();
        navigator.clipboard.writeText(text);
        term.clearSelection();
      } else {
        navigator.clipboard.readText().then((text) => {
          if (text) {
            window.electronAPI.sendPtyInput(ptyId, text);
          }
        });
      }
    };

    const containerEl = containerRef.current;
    containerEl.addEventListener('contextmenu', handleContextMenu);

    // Initial fit
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
        if (isActive && isFocused) term.focus();
      } catch (e) {}
    });

    // Attach to PTY
    window.electronAPI.attachPty(ptyId).then((res) => {
      if (res && res.buffer) {
        term.write(res.buffer);
      }
      setTimeout(() => {
        try {
          fitAddon.fit();
          if (isActive && isFocused) term.focus();
        } catch (e) {}
      }, 100);
    });

    // Terminal IO
    const dataDisposable = term.onData((data) => {
      window.electronAPI.sendPtyInput(ptyId, data);
      term.scrollToBottom();
    });

    const resizeDisposable = term.onResize(({ cols, rows }) => {
      window.electronAPI.resizePty(ptyId, cols, rows);
    });

    let pendingWrite = '';
    let writeRaf: number | null = null;

    const flushWrite = () => {
      if (pendingWrite && termRef.current) {
        const chunk = pendingWrite;
        pendingWrite = '';
        const buf = termRef.current.buffer.active;
        const wasAtBottom = buf.viewportY >= buf.baseY - 1;
        termRef.current.write(chunk, () => {
          if (wasAtBottom && termRef.current) {
            termRef.current.scrollToBottom();
          }
        });
      }
      writeRaf = null;
    };

    const removeOutputListener = window.electronAPI.onPtyOutput((payload) => {
      if (payload.sessionId === ptyId) {
        pendingWrite += payload.data;
        if (writeRaf === null) {
          writeRaf = requestAnimationFrame(flushWrite);
        }
      }
    });

    const handleResize = () => {
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch (e) {}
      }
    };
    window.addEventListener('resize', handleResize);

    // Continuous ResizeObserver for fluid split resizing without black gaps or oscillation loops
    let lastWidth = containerEl.clientWidth;
    let lastHeight = containerEl.clientHeight;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // Only fit if physical container pixel size changed by at least 2px
        if (Math.abs(width - lastWidth) >= 2 || Math.abs(height - lastHeight) >= 2) {
          lastWidth = width;
          lastHeight = height;
          if (fitAddonRef.current && containerRef.current && containerRef.current.clientWidth > 0) {
            try {
              fitAddonRef.current.fit();
            } catch (e) {}
          }
        }
      }
    });
    resizeObserver.observe(containerEl);

    return () => {
      if (writeRaf !== null) {
        cancelAnimationFrame(writeRaf);
        if (pendingWrite && termRef.current) {
          termRef.current.write(pendingWrite);
        }
      }
      dataDisposable.dispose();
      resizeDisposable.dispose();
      removeOutputListener();
      containerEl.removeEventListener('contextmenu', handleContextMenu);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [ptyId, themeName]);

  // Refit on activation or focus change
  useEffect(() => {
    if (isActive && fitAddonRef.current && termRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
          if (isFocused) {
            termRef.current?.focus();
          }
        } catch (e) {}
      }, 50);
    }
  }, [isActive, isFocused]);

  const currentTheme = THEMES[themeName] || THEMES.campbell;

  return (
    <div
      ref={containerRef}
      onClick={() => onFocus && onFocus()}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: currentTheme.background,
        opacity: isFocused ? 1 : 0.88,
        transition: 'opacity 0.15s ease',
      }}
    />
  );
};
