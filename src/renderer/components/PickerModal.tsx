import React, { useState } from 'react';
import { PickerConfig } from '../../shared/types';

interface PickerModalProps {
  picker: PickerConfig;
  onSelect: (selection: string) => void;
}

export const PickerModal: React.FC<PickerModalProps> = ({ picker, onSelect }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(3px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '80px',
      }}
    >
      <div
        style={{
          width: '500px',
          backgroundColor: '#18181b',
          border: '1px solid #3f3f46',
          borderRadius: '8px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #27272a', fontWeight: 600, fontSize: '13px', color: '#f4f4f5' }}>
          {picker.prompt}
        </div>
        <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '6px 0' }}>
          {picker.options.map((opt, idx) => (
            <div
              key={opt}
              onClick={() => onSelect(opt)}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                cursor: 'pointer',
                backgroundColor: idx === selectedIndex ? '#27272a' : 'transparent',
                color: idx === selectedIndex ? '#ffffff' : '#a1a1aa',
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              {opt}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
