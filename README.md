# 伴学知识库

> 基于 React Native (Expo) 的跨平台 AI 交互学习工具，集成 GeoGebra 图形计算器 + DeepSeek AI 对话
>
> *由 [MathLearningTool](https://github.com/Cuckovo/MathLearningTool) 重构而来*

## 项目定位

伴学知识库是一套**以 AI Agent 为核心、学科工具为辅助**的交互式学习系统。通过与 AI 的自然对话，用户不仅解答问题，还能构建、维护属于自己的个人知识库——从定制学科大纲开始，到知识校验、笔记沉淀，最终形成可检索、可检测的知识网络。

### 核心设计理念

```
AI 交互 ──→ 解题 & 答疑
    │
    └──→ 构建个人知识库 ──→ 知识校验 & 复习
              │
              └──→ 跨学科知识网络
              └──→ 第三方兼容（如 Obsidian）
```

## 功能概览

### 三大模块

| 模块 | 功能 | 状态 |
|------|------|------|
| 📐 **GeoGebra 绘图** | 离线渲染 GeoGebra 图形计算器，支持缩放/平移/函数输入 | ✅ 已完成 |
| 🤖 **AI 数学助手** | DeepSeek 大模型分步解题，自动提取函数表达式并绘制图像 | ✅ 已完成 |
| 📦 **知识库** | 学科大纲定制、知识沉淀、进度校验（预留） | 🚧 待开发 |

## 技术栈

基于 **Expo SDK 56 + React 19 + React Native 0.85** 构建，`NativeWind` (TailwindCSS 3.4) 处理样式。GeoGebra 通过 `react-native-webview` 加载离线包，DeepSeek Chat API 提供 AI 能力。本地数据后续将迁移至 **WatermelonDB**（基于 SQLite，支持复杂关系查询与懒加载），统一管理对话持久化和知识库树形数据。

## 项目结构

```
src/
├── app/
│   ├── _layout.tsx          # 根布局：3 Tab 导航 + 全局状态 Provider
│   ├── index.tsx            # 首页：GeoGebra WebView/iframe
│   ├── ai-chat.tsx          # AI 对话页面（含历史面板、操作按钮）
│   └── more.tsx             # 预留页面（未来：知识库）
├── constants/
│   ├── icons.tsx            # SVG 图标组件库
│   └── theme.ts             # Skland 品牌色 Token
├── lib/
│   ├── app-state.tsx        # 全局状态 Context + ChatSession 管理
│   ├── ai-parser.ts         # AI 输出解析器（正则提取解题过程/图像判断/表达式）
│   └── api.ts               # DeepSeek API 客户端
└── global.css               # TailwindCSS + Skland CSS 变量
```

## 路线图

### 📐 Math 数学模块（当前阶段：维护完善）

当前专注数学学科，完善 GeoGebra 绘图 + AI 数学解题的闭环体验。

- [x] GeoGebra 离线集成 + AI → GeoGebra 跨页面绘图联动
- [x] DeepSeek AI 对话 + 结构化输出解析
- [x] 多会话历史 + 左侧滑出历史面板
- [x] 3 Tab 导航 + NativeWind Skland 主题
- [x] Android Release APK 打包
- [ ] LaTeX 公式渲染（KaTeX WebView 方案）
- [ ] AI 流式输出（SSE）
- [ ] 对话上下文长度优化

### 📦 知识库（下一阶段：核心开发）

> **后续计划**：将本地持久化从 AsyncStorage 迁移到 WatermelonDB（基于 SQLite），统一管理对话数据和知识库树形结构。

在数学模块稳定后，以数学为示例学科，逐步实现知识库体系。核心目标：**通过 AI 对话驱动数据库的增删改查交互**，再逐步构建渲染层和导出能力。

#### Phase 1 — 大纲构建 & 数据库交互

- [ ] **AI 生成学科大纲**：以《同济大学高等数学》为示例教材，通过 AI Agent 在对话中生成符合教材结构的学习大纲
- [ ] **大纲索引表建库**：在 WatermelonDB 中创建对应的大纲知识索引表（章节 → 知识点 → 学习状态）
- [ ] **AI 数据库 CRUD 交互**：重点实现大模型对数据库的增删改查——对话中自然语言操作大纲节点，AI 自动转换为数据库操作

#### Phase 2 — 内容填充 & 节点渲染

- [ ] **知识内容 AI 沉淀**：对话解题过程中，AI 自动提取关键知识点，插入到对应大纲节点下
- [ ] **大纲树状渲染**：将大纲索引表可视化渲染为可交互的树形结构
- [ ] **节点级交互**：单点查看/编辑/删除知识点，追踪每个节点的学习状态

#### Phase 3 — 上下文导出 & 跨平台

- [ ] **数据库上下文读取**：AI 对话中可随时检索知识库全文上下文，用于复习问答和知识校验
- [ ] **Obsidian 导出**：支持将知识库导出为 Obsidian 兼容的 Markdown 格式（含双链 [[wiki-link]] 和 frontmatter）
- [ ] **跨学科扩展**：从高数扩展到物理、化学等更多学科
