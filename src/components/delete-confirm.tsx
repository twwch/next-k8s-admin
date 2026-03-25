'use client';

import { useState } from 'react';
import { Button, Popconfirm, Modal, Input, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface Props {
  name: string;
  kindLabel: string;
  onConfirm: () => Promise<void>;
}

export default function DeleteConfirm({ name, kindLabel, onConfirm }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onConfirm();
      setModalOpen(false);
    } finally {
      setLoading(false);
      setInputValue('');
    }
  };

  return (
    <>
      <Popconfirm title="确认要删除此资源？" onConfirm={() => setModalOpen(true)}>
        <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
      </Popconfirm>
      <Modal
        title={`删除 ${kindLabel}`}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setInputValue(''); }}
        onOk={handleDelete}
        okText="确认删除"
        okType="danger"
        okButtonProps={{ disabled: inputValue !== name }}
        confirmLoading={loading}
        destroyOnHidden
      >
        <div style={{ marginBottom: 16 }}>
          <Text>请输入资源名称以确认删除：</Text>
        </div>
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={name}
        />
        <div style={{ marginTop: 8 }}>
          <Text type="secondary">输入 <Text strong code>{name}</Text> 以确认</Text>
        </div>
      </Modal>
    </>
  );
}
