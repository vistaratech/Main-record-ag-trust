import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AlignLeft, AlignCenter, AlignRight, Type, Paintbrush, X, RotateCcw, Bell } from 'lucide-react';
import type { CellStyle } from '../../lib/api';

// Curated palette with good contrast on both light and dark backgrounds
const TEXT_COLORS = [
  '#000000', '#374151', '#991B1B', '#9A3412', '#854D0E',
  '#166534', '#1E40AF', '#5B21B6', '#9D174D', '#0F766E',
  '#DC2626', '#EA580C', '#CA8A04', '#16A34A', '#2563EB',
  '#7C3AED', '#DB2777', '#0D9488', '#6B7280', '#FFFFFF',
];

const BG_COLORS = [
  'transparent', '#FEF2F2', '#FFF7ED', '#FEFCE8', '#F0FDF4',
  '#EFF6FF', '#F5F3FF', '#FDF2F8', '#F0FDFA', '#F9FAFB',
  '#FECACA', '#FED7AA', '#FDE68A', '#BBF7D0', '#BFDBFE',
  '#DDD6FE', '#FBCFE8', '#99F6E4', '#E5E7EB', '#FFFFFF',
];

interface CellFormatToolbarProps {
  position: { top: number; left: number };
  currentStyle: CellStyle;
  onStyleChange: (style: Partial<CellStyle>) => void;
  onClearStyle: () => void;
  onAddReminder?: () => void;
  onClose: () => void;
}

export const CellFormatToolbar = React.memo(function CellFormatToolbar({
  position, currentStyle, onStyleChange, onClearStyle, onAddReminder, onClose
}: CellFormatToolbarProps) {
  const [activePanel, setActivePanel] = useState<'textColor' | 'bgColor' | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleTextColor = useCallback((color: string) => {
    onStyleChange({ textColor: color });
    setActivePanel(null);
  }, [onStyleChange]);

  const handleBgColor = useCallback((color: string) => {
    onStyleChange({ bgColor: color === 'transparent' ? undefined : color });
    setActivePanel(null);
  }, [onStyleChange]);

  const handleAlignment = useCallback((align: 'left' | 'center' | 'right') => {
    onStyleChange({ textAlign: align });
  }, [onStyleChange]);

  // Calculate a safe position that doesn't go off-screen
  const safeTop = Math.max(8, Math.min(position.top - 48, window.innerHeight - 200));
  const safeLeft = Math.max(8, Math.min(position.left, window.innerWidth - 320));

  return (
    <div
      ref={toolbarRef}
      className="cell-format-toolbar"
      style={{
        position: 'fixed',
        top: safeTop,
        left: safeLeft,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        borderRadius: '10px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)',
        border: '1px solid #e5e7eb',
        overflow: 'visible',
        userSelect: 'none',
      }}
    >
      {/* Main toolbar row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 8px' }}>
        {/* Text Color */}
        <button
          title="Text Color"
          onClick={() => setActivePanel(activePanel === 'textColor' ? null : 'textColor')}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            width: '32px', height: '32px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            background: activePanel === 'textColor' ? '#EFF6FF' : 'transparent',
            transition: 'background 0.15s',
          }}
        >
          <Type size={16} color={currentStyle.textColor || '#000'} strokeWidth={2.5} />
          <div style={{ width: '14px', height: '3px', borderRadius: '2px', marginTop: '1px', background: currentStyle.textColor || '#000' }} />
        </button>

        <div style={{ width: '1px', height: '20px', background: '#e5e7eb', margin: '0 2px' }} />

        {/* Background Color */}
        <button
          title="Cell Background"
          onClick={() => setActivePanel(activePanel === 'bgColor' ? null : 'bgColor')}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            width: '32px', height: '32px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            background: activePanel === 'bgColor' ? '#EFF6FF' : 'transparent',
            transition: 'background 0.15s',
          }}
        >
          <Paintbrush size={16} color="#6b7280" />
          <div style={{ width: '14px', height: '3px', borderRadius: '2px', marginTop: '1px', background: currentStyle.bgColor || '#e5e7eb', border: currentStyle.bgColor ? 'none' : '1px solid #d1d5db' }} />
        </button>

        <div style={{ width: '1px', height: '20px', background: '#e5e7eb', margin: '0 2px' }} />

        {/* Alignment */}
        {(['left', 'center', 'right'] as const).map(align => {
          const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
          const isActive = (currentStyle.textAlign || 'left') === align;
          return (
            <button
              key={align}
              title={`Align ${align}`}
              onClick={() => handleAlignment(align)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '32px', height: '32px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: isActive ? '#EFF6FF' : 'transparent',
                color: isActive ? '#2563EB' : '#6b7280',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
            </button>
          );
        })}

        <div style={{ width: '1px', height: '20px', background: '#e5e7eb', margin: '0 2px' }} />

        {/* Clear formatting */}
        <button
          title="Clear Formatting"
          onClick={onClearStyle}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '32px', height: '32px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            background: 'transparent', color: '#6b7280',
            transition: 'background 0.15s',
          }}
        >
          <RotateCcw size={14} />
        </button>

        {onAddReminder && (
          <>
            <div style={{ width: '1px', height: '20px', background: '#e5e7eb', margin: '0 2px' }} />
            <button
              type="button"
              title="Add Reminder"
              onClick={(e) => {
                e.stopPropagation();
                onAddReminder();
                onClose();
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '32px', height: '32px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: 'transparent', color: '#6b7280',
                transition: 'background 0.15s',
              }}
            >
              <Bell size={14} />
            </button>
          </>
        )}

        <div style={{ width: '1px', height: '20px', background: '#e5e7eb', margin: '0 2px' }} />

        {/* Close */}
        <button
          title="Close"
          onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '28px', height: '28px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            background: 'transparent', color: '#9ca3af',
            transition: 'background 0.15s',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Color Picker Panel */}
      {activePanel && (
        <div style={{
          padding: '8px 10px 10px',
          borderTop: '1px solid #f3f4f6',
          background: '#fafafa',
          borderBottomLeftRadius: '10px',
          borderBottomRightRadius: '10px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {activePanel === 'textColor' ? 'Text Color' : 'Background Color'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px' }}>
            {(activePanel === 'textColor' ? TEXT_COLORS : BG_COLORS).map((color, i) => {
              const isSelected = activePanel === 'textColor'
                ? (currentStyle.textColor || '#000000') === color
                : (currentStyle.bgColor || 'transparent') === color;
              const isTransparent = color === 'transparent';
              return (
                <button
                  key={i}
                  onClick={() => activePanel === 'textColor' ? handleTextColor(color) : handleBgColor(color)}
                  title={isTransparent ? 'No fill' : color}
                  style={{
                    width: '22px', height: '22px', borderRadius: '4px', cursor: 'pointer',
                    border: isSelected ? '2px solid #2563EB' : '1px solid #e5e7eb',
                    background: isTransparent ? 'repeating-conic-gradient(#d1d5db 0% 25%, transparent 0% 50%) 50% / 10px 10px' : color,
                    transition: 'transform 0.1s',
                    transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                    boxShadow: isSelected ? '0 0 0 1px #2563EB' : 'none',
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
