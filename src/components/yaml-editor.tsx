'use client';

import { useRef } from 'react';

interface Props {
  value?: string;
  onChange?: (value: string) => void;
  height?: number;
  readOnly?: boolean;
  placeholder?: string;
}

export default function YamlEditor({ value = '', onChange, height = 400, readOnly = false, placeholder }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea || readOnly) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange?.(newValue);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  };

  return (
    <div style={{
      position: 'relative',
      border: '1px solid #d9d9d9',
      borderRadius: 6,
      overflow: 'hidden',
      backgroundColor: '#1e1e2e',
    }}>
      <div style={{
        position: 'absolute',
        top: 8,
        right: 12,
        fontSize: 11,
        color: '#6c7086',
        userSelect: 'none',
        zIndex: 1,
      }}>
        YAML
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        placeholder={placeholder}
        spellCheck={false}
        style={{
          width: '100%',
          height,
          padding: '12px 16px',
          fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace",
          fontSize: 13,
          lineHeight: 1.6,
          color: '#cdd6f4',
          backgroundColor: 'transparent',
          border: 'none',
          outline: 'none',
          resize: 'vertical',
          tabSize: 2,
          whiteSpace: 'pre',
          overflowWrap: 'normal',
          overflowX: 'auto',
        }}
      />
    </div>
  );
}
