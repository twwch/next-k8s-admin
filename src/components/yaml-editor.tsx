'use client';

import { Input } from 'antd';

interface Props {
  value?: string;
  onChange?: (value: string) => void;
  rows?: number;
}

export default function YamlEditor({ value, onChange, rows = 15 }: Props) {
  return (
    <Input.TextArea
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      rows={rows}
      style={{ fontFamily: 'monospace', fontSize: 13 }}
      placeholder="输入 YAML/JSON 内容..."
    />
  );
}
