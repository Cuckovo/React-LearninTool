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

基于 **Expo SDK 56 + React 19 + React Native 0.85** 构建，`NativeWind` (TailwindCSS 3.4) 处理样式。GeoGebra 通过 `react-native-webview` 加载离线包，DeepSeek Chat API 提供 AI 能力。

| 层级 | 技术 |
|------|------|
| 框架 | Expo SDK 56 + Expo Router |
| UI | React 19 + React Native 0.85 + NativeWind |
| 状态管理 | React Context + useReducer |
| 数据库 | expo-sqlite（Web: OPFS Worker / Native: 原生 SQLite） |
| ORM | Drizzle ORM（Schema 定义 + 类型声明） |
| AI 后端 | DeepSeek Chat API（解题 + 知识库教学双模式） |
| 图形计算 | GeoGebra 5 离线包 (80MB) + postMessage 通信 |
| 公式渲染 | 自研轻量 Markdown → HTML 渲染器（保护 LaTeX 公式） |

## 项目结构

```
src/
├── app/
│   ├── _layout.tsx            # 根布局：3 Tab 导航 + 全局状态 Provider
│   ├── index.tsx              # 首页：GeoGebra WebView/iframe
│   ├── ai-chat.tsx            # AI 对话页面（解题 + 知识库双模式）
│   └── knowledge.tsx          # 知识库页面（树形大纲 → 详情页滑动导航）
├── components/
│   ├── chat/
│   │   ├── mode-switcher.tsx          # 解题 / 知识库模式切换按钮
│   │   └── assessment-result-card.tsx # 考核评分结果卡片
│   └── knowledge/
│       ├── outline-page.tsx           # 知识树大纲页（可展开/收起的树形列表）
│       ├── detail-page.tsx            # 知识点详情页（教学/AI对话/笔记）
│       ├── knowledge-tree.tsx         # 递归树节点渲染组件
│       ├── progress-overview.tsx      # 掌握进度总览
│       └── mastery-badge.tsx          # 掌握状态徽章
├── constants/
│   ├── icons.tsx              # SVG 图标组件库（3 Tab 图标）
│   └── theme.ts               # Skland/HYPERGRYPH 品牌色 Token
├── db/
│   ├── schema.ts              # Drizzle ORM Schema（sessions/messages/knowledge_nodes/agent_logs）
│   ├── database.ts            # 平台自适应数据库初始化 + 幂等建表
│   ├── repository.ts          # 对话数据仓库层（getAllSessions/addMessage 等）
│   ├── knowledge-service.ts   # 知识库数据服务层（知识树 CRUD + 进度统计 + Agent 日志）
│   ├── migrate.ts             # AsyncStorage → SQLite 迁移（幂等，保留旧数据）
│   ├── seed-outline.ts        # 高等数学种子数据（同济版第一章 5 节含权威定义）
│   └── logger.ts              # 分级日志模块（none/error/warn/info/debug）
├── lib/
│   ├── app-state.tsx          # 全局状态 Context + ChatSession/KnowledgeSession 管理
│   ├── api.ts                 # DeepSeek API 客户端
│   ├── ai-parser.ts           # AI 输出解析器（解题/DB指令/评分标记）
│   ├── knowledge-prompt.ts    # 知识库教学系统提示词 + 考核触发规则 + 节点上下文构建
│   ├── assessment-prompt.ts   # 考核评分系统提示词 + 评分请求构建 + 结果解析
│   ├── markdown-renderer.ts   # 轻量 Markdown → HTML 渲染器（LaTeX 公式保护）
│   ├── stream-buffer.ts       # 流式传输缓冲渲染管理器
│   └── db-command-parser.ts   # AI 回复中的 DB 操作指令解析器
├── types/
│   └── knowledge.ts           # 知识库类型定义（KnowledgeNode/TreeNode/DBCommand/AssessmentResult 等）
└── global.css                 # TailwindCSS + Skland CSS 变量
```

## 路线图

### 📐 数学解题模块

- [x] GeoGebra 离线集成 + AI → GeoGebra 跨页面绘图联动
- [x] DeepSeek AI 对话 + 结构化输出解析
- [x] 多会话历史 + 左侧滑出历史面板
- [x] 3 Tab 导航 + NativeWind Skland 主题
- [x] Android Release APK 打包
- [x] **数据库迁移**：AsyncStorage 替换为 expo-sqlite（Web OPFS / Native SQLite）
- [x] **分级日志**：.env 控制 EXPO_PUBLIC_DB_LOG_LEVEL 输出级别
- [ ] ~~LaTeX 公式渲染（KaTeX WebView 方案）~~ → 已改用自研 Markdown → HTML 渲染器
- [ ] AI 流式输出（SSE）— StreamBuffer 已就绪，待接入 API

### 📦 知识库模块

> **已完成**：本地持久化已从 AsyncStorage 迁移至 expo-sqlite，统一管理对话数据和知识库树形结构。

#### Phase 1 — 大纲构建 & 数据库交互（✅ 基本完成）

- [x] **数据库驱动架构**：expo-sqlite 统管对话 + 知识库（sessions / messages / knowledge_nodes / agent_logs 四表）
- [x] **学科大纲种子数据**：以《同济大学高等数学》第一章为示例（映射/函数/反函数/复合函数/初等函数，含权威定义）
- [x] **AI 数据库 CRUD 交互**：对话中 AI 输出 ` ```db ` 代码块 → `set_user_notes` / `set_mastery` 自动操作数据库
- [ ] **AI 生成学科大纲**：通过 AI Agent 在对话中自动生成完整大纲（当前为预置种子数据）

#### Phase 2 — 内容填充 & 节点渲染（✅ 基本完成）

- [x] **知识内容 AI 沉淀**：知识库学习模式下 AI 自动将笔记摘要保存到节点 `user_notes`
- [x] **大纲树状渲染**：可展开/收起的 4 级树形结构（学科 → 章 → 节 → 概念），含掌握状态徽章
- [x] **节点级交互**：点击叶子节点进入详情页 → 查看标准定义 → 进入 AI 对话教学 → 笔记编辑
- [x] **模式切换**：解题模式与知识库学习模式一键切换，独立 Session 隔离
- [x] **响应式布局**：手机端滑动导航（大纲 ↔ 详情），宽屏端左右分栏
- [x] **进度概览**：全局掌握程度百分比 + 通过/学习中/未开始 分类统计

#### Phase 3 — 考核与反馈（✅ 基本完成）

- [x] **AI 出题考核**：知识库模式下 AI 根据节点标准定义出题（2-3 道判断/填空题）
- [x] **自动评分**：用户回答后 AI 独立评分评测（0-100 分 + 详细解析 + 薄弱点分析）
- [x] **掌握状态自动更新**：评分 ≥70 → 自动标记 `passed` + 保存建议笔记

#### Phase 4 — 跨端 & 扩展（🚧 待开发）

- [ ] **Obsidian 导出**：支持将知识库导出为 Obsidian 兼容的 Markdown 格式（含双链 `[[wiki-link]]` 和 frontmatter）
- [ ] **跨学科扩展**：从高数扩展到物理、化学等更多学科
- [ ] **对话上下文检索**：AI 对话中可随时检索知识库全文上下文，用于复习问答和知识校验
- [ ] **迁移剩余章节骨架**：种子数据当前仅含第一章（函数与极限）的 10 节骨架 + 5 个概念叶子
- [ ] **AI 流式输出**：StreamBuffer 已就绪，支持流式 Markdown/LaTeX 渲染

### ⚙️ 基础设施

- [x] ESBuild 模块化架构替代原始 API 拼接
- [x] 数据库结构文档化（`docs/数据库结构.md`）
- [x] 分级日志 + .env 开发配置（`EXPO_PUBLIC_DB_LOG_LEVEL`）
- [ ] 单元测试 / 集成测试
- [ ] CI/CD 自动构建流水线
