# K8s Admin 全站 UI 重新设计

## 概述

对 K8s Admin 全站进行视觉翻新，采用精致企业风设计语言，提升视觉一致性和品牌感。

## 设计决策

| 维度 | 决策 |
|------|------|
| 整体风格 | 精致企业风 — 渐变色卡片、柔和阴影、趋势指标 |
| 登录页 | 左右分栏 — 左侧品牌展示区 + 右侧登录表单 |
| 列表页 | 整体 Card 包裹 — 页头(标题+描述+按钮+筛选) + 表格在同一个 Card 中 |
| 集群切换器 | 品牌色胶囊按钮 — 蓝色渐变胶囊 + 连接状态圆点 |
| 范围 | 全站所有页面 |

## 设计规范

### 色彩体系

- 品牌主色：`#326CE5`（K8s 蓝）
- 品牌渐变：`linear-gradient(135deg, #326CE5, #1a4bc7)`
- 成功/健康：`#10b981`
- 警告：`#f59e0b`
- 危险/错误：`#ef4444`
- 紫色强调：`#8b5cf6`（用于 Deployments 等统计卡片）
- 文字主色：`#0f172a`
- 文字次要：`#64748b`
- 文字辅助：`#94a3b8`
- 页面背景：`#f5f7fa`
- Card 背景：`#ffffff`
- Card 阴影：`0 1px 3px rgba(0,0,0,0.08)`
- Card 圆角：`12px`

### 统计卡片规范

- 渐变色背景（每个指标不同色系）
- 白色文字
- 上方：小号标签（指标名称，opacity 0.85）
- 中间：大号数值（font-weight 700）
- 下方：趋势/补充信息（小号，opacity 0.7）
- 圆角：`10px`

### 列表页 Card 结构

```
┌─────────────────────────────────────────┐
│ Card (border-radius: 12px, shadow)      │
│ ┌─────────────────────────────────────┐ │
│ │ 页头区域 (padding: 20px 24px)       │ │
│ │  标题(16px bold) + 描述(次要色)     │ │
│ │  操作按钮（渐变蓝，右对齐）          │ │
│ │  筛选/搜索栏（如有）                │ │
│ ├─────────────────────────────────────┤ │
│ │ 表格区域                            │ │
│ │  Ant Design Table size="middle"     │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## 改造范围

### 1. 新增共享组件

#### `PageContainer` 组件
统一所有列表页的页头+Card 包裹结构。

Props:
- `title: string` — 页面标题
- `description?: string` — 页面描述
- `extra?: ReactNode` — 右侧操作区（按钮等）
- `filters?: ReactNode` — 筛选/搜索栏
- `children: ReactNode` — 内容区（表格等）

#### `StatCard` 组件
统一 Dashboard 统计卡片。

Props:
- `title: string` — 指标名称
- `value: number | string` — 数值
- `gradient: string` — 渐变色
- `icon: ReactNode` — 图标
- `footer?: string` — 趋势/补充信息

#### `ClusterSelector` 组件（重写）
品牌色胶囊按钮样式，显示连接状态圆点 + 集群名 + 下拉箭头。使用 Ant Design Dropdown + 自定义触发器。

### 2. 登录页改造

**当前**：居中卡片，灰色背景
**改造后**：左右分栏布局
- 左侧：深蓝到品牌蓝渐变背景，展示 Logo + 产品名 + 描述 + 集群在线状态
- 右侧：白色背景，「欢迎回来」标题 + 登录表单（保留 Tabs 切换账号密码/邮箱验证码）
- Auth layout 需要同步改造

### 3. 改密页改造

同步登录页左右分栏风格，左侧品牌区一致，右侧放改密表单。

### 4. Dashboard 改造

**当前**：4 个白底 Statistic 卡片 + 事件列表 + 集群状态列表
**改造后**：
- 4 个渐变色 StatCard（蓝/绿/紫/橙），带趋势指标
- 事件列表包在 Card 中，事件行使用圆角 Tag + 时间右对齐
- 集群状态列表包在 Card 中

### 5. 集群管理页改造

**当前**：裸 Title + 裸 Table
**改造后**：PageContainer 包裹，添加描述文字

### 6. 添加集群页

**当前**：已有 Card 包裹，基本 OK
**改造后**：Card 圆角升级为 12px，按钮使用渐变色

### 7. 用户管理页改造

**当前**：裸 `<h2>` + 裸 Table
**改造后**：PageContainer 包裹，Modal 样式通过 ConfigProvider 统一

### 8. 角色管理页改造

**当前**：裸 `<h2>` + 裸 Table + 原生 HTML `<table>` 权限矩阵
**改造后**：
- PageContainer 包裹
- 权限矩阵改用 Ant Design `<Checkbox>` + `<Table>` 组件重写
- 权限矩阵表格带交替行背景色，表头固定

### 9. 审计日志页改造

**当前**：裸 `<h2>` + 裸 Select 筛选 + 裸 Table
**改造后**：PageContainer 包裹，筛选器整合到页头 filters 区域

### 10. 发布记录页改造

**当前**：裸 Title + 裸 Table
**改造后**：PageContainer 包裹

### 11. 资源页面（Pods, Deployments, StatefulSets, DaemonSets, Jobs, Services, Ingresses, ConfigMaps, Secrets, PVCs, StorageClasses, Namespaces）

**当前**：裸 Title + NamespaceSelector + ResourceTable
**改造后**：PageContainer 包裹，NamespaceSelector 整合到 filters 区域

### 12. 全局样式调整

- Ant Design ConfigProvider token 调整：Card 圆角 12px、按钮圆角 6px
- 主要操作按钮统一使用渐变色（通过 CSS class 或 style）
- Table 统一使用 `size="middle"`

## 实施策略

1. 先创建 `PageContainer`、`StatCard` 共享组件
2. 改造 `ClusterSelector` 组件
3. 改造登录页 + 改密页（Auth layout）
4. 改造 Dashboard
5. 逐个改造列表页面（用 PageContainer 替换裸标题+裸表格）
6. 角色管理权限矩阵重写
7. 全局 ConfigProvider token 微调
