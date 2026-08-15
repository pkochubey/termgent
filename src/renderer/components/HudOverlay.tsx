import React from 'react';
import { HudConfig } from '../../shared/types.js';
import { Loader2, X } from 'lucide-react';

interface HudOverlayProps {
  config: HudConfig;
  onClose: () => void;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({ config, onClose }) => {
  const getPositionStyles = (): React.CSSProperties => {
    switch (config.position) {
      case 'top-left':
        return { top: '50px', left: '20px' };
      case 'bottom-right':
        return { bottom: '20px', right: '20px' };
      case 'bottom-left':
        return { bottom: '20px', left: '20px' };
      case 'center':
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      case 'top-right':
      default:
        return { top: '50px', right: '20px' };
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        ...getPositionStyles(),
        zIndex: 500,
        backgroundColor: 'rgba(24, 24, 27, 0.88)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '8px',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        maxWidth: '360px',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      {config.spinner && (
        <Loader2
          size={16}
          color="#3b82f6"
          style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: '#f4f4f5',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {config.message}
        </span>
        {config.detail && (
          <span
            style={{
              fontSize: '11px',
              color: '#a1a1aa',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: '2px',
            }}
          >
            {config.detail}
          </span>
        )}
      </div>

      <button
        onClick={onClose}
        style={{
          backgroundColor: 'transparent',
          border: 'none',
          color: '#71717a',
          cursor: 'pointer',
          padding: '2px',
          display: 'flex',
          alignItems: 'center',
          borderRadius: '3px',
        }}
      >
        <X size={14} />
      </button>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
