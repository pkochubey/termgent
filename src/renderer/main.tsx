import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/global.css';

// Declare Window.electronAPI type
declare global {
  interface Window {
    electronAPI: {
      getState: () => Promise<any>;
      onStateUpdated: (cb: (state: any) => void) => () => void;

      createWorkspace: (name: string) => void;
      selectWorkspace: (id: string) => void;
      renameWorkspace: (id: string, name: string) => void;
      deleteWorkspace: (id: string) => void;

      createSession: (opts?: { workspaceId?: string; cwd?: string; name?: string }) => void;
      selectSession: (id: string) => void;
      renameSession: (id: string, name: string) => void;
      closeSession: (id: string) => void;
      setSessionStatus: (id: string, status: string) => void;

      sendPtyInput: (sessionId: string, data: string) => void;
      resizePty: (sessionId: string, cols: number, rows: number) => void;
      onPtyOutput: (cb: (data: { sessionId: string; data: string }) => void) => () => void;

      onOverlayStart: (cb: (overlay: any) => void) => () => void;
      onPickerShow: (cb: (picker: any) => void) => () => void;
      selectPickerOption: (pickerId: string, selection: string) => void;
      onToggleScratch: (cb: () => void) => () => void;
    };
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
