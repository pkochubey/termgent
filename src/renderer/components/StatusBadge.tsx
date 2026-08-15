import React from 'react';
import { SessionStatus } from '../../shared/types';

interface StatusBadgeProps {
  status: SessionStatus;
  style?: React.CSSProperties;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, style = {} }) => {
  switch (status) {
    case 'active':
      return (
        <span
          style={{
            display: 'inline-block',
            width: '9px',
            height: '9px',
            borderRadius: '50%',
            backgroundColor: '#38bdf8',
            boxShadow: '0 0 10px #38bdf8, 0 0 4px #0284c7',
            marginRight: '6px',
            flexShrink: 0,
            ...style,
          }}
          title="Agent Active (Thinking / Generating...)"
        />
      );
    case 'blocked':
      return (
        <span
          style={{
            display: 'inline-block',
            width: '9px',
            height: '9px',
            borderRadius: '50%',
            backgroundColor: '#f59e0b',
            boxShadow: '0 0 10px #f59e0b, 0 0 4px #d97706',
            marginRight: '6px',
            flexShrink: 0,
            ...style,
          }}
          title="Agent Blocked (Waiting for user approval / y-n)"
        />
      );
    case 'completed':
      return (
        <span
          style={{
            display: 'inline-block',
            width: '9px',
            height: '9px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            boxShadow: '0 0 10px #10b981, 0 0 4px #059669',
            marginRight: '6px',
            flexShrink: 0,
            ...style,
          }}
          title="Agent Task Completed"
        />
      );
    case 'idle':
    default:
      return (
        <span
          style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#52525b',
            marginRight: '6px',
            flexShrink: 0,
            opacity: 0.6,
            ...style,
          }}
          title="Idle"
        />
      );
  }
};
