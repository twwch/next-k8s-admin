interface ReleaseInfo {
  releaseName: string;
  clusterName: string;
  namespace: string;
  templateName?: string;
  image?: string;
  revision: number;
  status: string;
  message: string;
  operator: string;
  time: string;
}

function statusEmoji(status: string): string {
  switch (status) {
    case 'applied': return '✅';
    case 'failed': return '❌';
    case 'rolled_back': return '⏪';
    default: return '🔄';
  }
}

function statusText(status: string): string {
  switch (status) {
    case 'applied': return '发布成功';
    case 'failed': return '发布失败';
    case 'rolled_back': return '已回滚';
    case 'pending': return '发布中';
    default: return status;
  }
}

export async function sendFeishuNotification(webhookUrl: string, info: ReleaseInfo) {
  const card = {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        title: {
          tag: 'plain_text',
          content: `${statusEmoji(info.status)} 发布通知 · ${info.clusterName}`,
        },
        template: info.status === 'applied' ? 'green' : info.status === 'failed' ? 'red' : 'blue',
      },
      elements: [
        {
          tag: 'div',
          fields: [
            {
              is_short: true,
              text: { tag: 'lark_md', content: `**应用名称**\n${info.releaseName}` },
            },
            {
              is_short: true,
              text: { tag: 'lark_md', content: `**状态**\n${statusEmoji(info.status)} ${statusText(info.status)}` },
            },
            {
              is_short: true,
              text: { tag: 'lark_md', content: `**集群**\n${info.clusterName}` },
            },
            {
              is_short: true,
              text: { tag: 'lark_md', content: `**命名空间**\n${info.namespace}` },
            },
            {
              is_short: true,
              text: { tag: 'lark_md', content: `**镜像版本**\n${info.image || '-'}` },
            },
            {
              is_short: true,
              text: { tag: 'lark_md', content: `**操作人**\n${info.operator}` },
            },
          ],
        },
        ...(info.templateName ? [{
          tag: 'div',
          text: { tag: 'lark_md', content: `**模板**: ${info.templateName}` },
        }] : []),
        {
          tag: 'div',
          text: { tag: 'lark_md', content: `**变更说明**\n${info.message || '无'}` },
        },
        {
          tag: 'hr',
        },
        {
          tag: 'note',
          elements: [
            { tag: 'plain_text', content: `K8s Admin · ${info.time}` },
          ],
        },
      ],
    },
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });
    if (!res.ok) {
      console.error('Feishu notification failed:', await res.text());
    }
  } catch (err: any) {
    console.error('Feishu notification error:', err.message);
  }
}
