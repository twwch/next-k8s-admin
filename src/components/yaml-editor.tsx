'use client';

import { useCallback, useMemo } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';

interface Props {
  value?: string;
  onChange?: (value: string) => void;
  height?: number | string;
  readOnly?: boolean;
  placeholder?: string;
  diffBase?: string;
}

function highlightYaml(code: string): string {
  return Prism.highlight(code, Prism.languages.yaml, 'yaml');
}

function computeDiff(baseText: string, currentText: string): ('added' | 'modified' | null)[] {
  const baseLines = baseText.split('\n');
  const curLines = currentText.split('\n');
  const baseSet = new Set(baseLines);
  const m = baseLines.length;
  const result: ('added' | 'modified' | null)[] = [];
  let bi = 0;
  for (let ci = 0; ci < curLines.length; ci++) {
    let found = false;
    for (let j = bi; j < m; j++) {
      if (curLines[ci] === baseLines[j]) {
        bi = j + 1;
        found = true;
        break;
      }
    }
    if (found) result.push(null);
    else if (!baseSet.has(curLines[ci])) result.push('added');
    else result.push('modified');
  }
  return result;
}

const FONT = "Menlo, Monaco, Consolas, 'Courier New', monospace";
const FONT_SIZE = 13;
const LINE_PX = 21;
const LINE_HEIGHT = `${LINE_PX}px`;
const PADDING = 14;

export default function YamlEditor({ value = '', onChange, height = 400, readOnly = false, placeholder, diffBase }: Props) {
  const highlight = useCallback((code: string) => highlightYaml(code), []);

  const diffLines = useMemo(() => {
    if (!diffBase) return null;
    return computeDiff(diffBase, value);
  }, [value, diffBase]);

  // height="100%" means parent handles scrolling, just fill content
  const isFluid = height === '100%';

  return (
    <div style={{
      position: 'relative',
      borderRadius: 8,
      backgroundColor: '#0d1117',
      ...(isFluid ? {} : { height, overflow: 'auto' }),
    }}>
      <div style={{
        position: 'absolute', top: 8, right: 12,
        fontSize: 10, color: '#484f58', userSelect: 'none',
        zIndex: 2, fontWeight: 500, letterSpacing: 0.5,
      }}>
        YAML
      </div>
      <div style={{ display: 'inline-block', minWidth: '100%', position: 'relative' }}>
        {/* Diff backgrounds */}
        {diffLines && (
          <div style={{
            position: 'absolute', top: PADDING, left: 0, right: 0,
            pointerEvents: 'none', zIndex: 0,
          }}>
            {diffLines.map((status, i) => (
              <div key={i} style={{
                height: LINE_PX,
                background: status === 'added' ? 'rgba(63,185,80,0.18)'
                  : status === 'modified' ? 'rgba(210,153,34,0.22)' : 'transparent',
                borderLeft: status ? `3px solid ${status === 'added' ? '#3fb950' : '#d29922'}` : '3px solid transparent',
              }} />
            ))}
          </div>
        )}
        <Editor
          value={value}
          onValueChange={(v) => !readOnly && onChange?.(v)}
          highlight={highlight}
          padding={PADDING}
          placeholder={placeholder}
          readOnly={readOnly}
          tabSize={2}
          insertSpaces
          textareaClassName="ye-ta"
          preClassName="ye-pre"
          style={{
            fontFamily: FONT,
            fontSize: FONT_SIZE,
            lineHeight: LINE_HEIGHT,
            color: '#e6edf3',
            backgroundColor: 'transparent',
            caretColor: '#e6edf3',
            position: 'relative',
            zIndex: 1,
          }}
        />
      </div>
      <style>{`
        .ye-ta, .ye-pre {
          white-space: pre !important;
          word-wrap: normal !important;
          overflow-wrap: normal !important;
          font-family: ${FONT} !important;
          font-size: ${FONT_SIZE}px !important;
          line-height: ${LINE_HEIGHT} !important;
          tab-size: 2 !important;
          -moz-tab-size: 2 !important;
          font-variant-ligatures: none !important;
        }
        .ye-ta { outline: none !important; }
        .ye-ta::placeholder { color: #484f58 !important; }
        .token.key, .token.atrule { color: #7ee787 !important; }
        .token.string { color: #a5d6ff !important; }
        .token.number { color: #79c0ff !important; }
        .token.boolean { color: #ff7b72 !important; }
        .token.comment { color: #8b949e !important; font-style: italic; }
        .token.punctuation { color: #79c0ff !important; }
        .token.important { color: #ff7b72 !important; }
      `}</style>
    </div>
  );
}
