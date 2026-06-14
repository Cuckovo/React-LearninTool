# LearningTools 产品需求文档（PRD）

## 1. 项目信息

| 字段 | 内容 |
|------|------|
| **文档语言** | 中文 |
| **编程语言** | TypeScript (Strict Mode) |
| **项目名称** | learntools |
| **技术栈** | Expo SDK 56 + React 19 + React Native 0.85 + expo-router + NativeWind (TailwindCSS) + react-native-reanimated |
| **目标平台** | Android + Web |
| **设计体系** | Skland（品牌色 #90c208 / #c8eb21），映射到 NativeWind 自定义 token |
| **当前状态** | ✅ GeoGebra 首页已完成，项目结构已清理，基于 main 分支 |

### 1.1 GeoGebra 本地化方案（已落地）

| 方案 | 详情 |
|------|------|
| **精简策略** | 从 115MB 原包删除 web3d (48MB) / webSimple (20MB)，保留 web 版本 (48MB) |
| **存储位置** | `assets/geogebra/`（GeoGebra.html + web/ + css/） |
| **Web 端加载** | 复制到 `public/geogebra/` → Metro dev server serve → 原生 `<iframe>` 直接加载 |
| **Android 端加载** | `file:///android_asset/geogebra/GeoGebra.html`（WebView） |
| **关键修改** | `GeoGebra.html` 第 14 行 `module = "web3d"` → `"web"` |

---

## 2. 产品定义

### 2.1 Product Goals

1. **可交互的数学可视化**：用户打开应用即可在 GeoGebra 中绘制函数图形，支持缩放、平移等交互
2. **AI 驱动的解题体验**：用户输入高等数学问题，AI 给出分步解题过程，并能自动识别"可绘制"的函数表达式并渲染图形
3. **跨页面联动**：AI 对话页面解析出函数表达式后，可传递给 GeoGebra 页面并自动跳转绘图

### 2.2 User Stories

- **As a** 大学生，**I want** 打开应用就看到函数绘图工具，**so that** 我可以快速验证高数作业中的函数图像
- **As a** 学生，**I want** 在 AI 对话中输入微积分问题并获得分步解答，**so that** 我能理解解题思路
- **As a** 学生，**I want** AI 分析出函数后能自动跳转到绘图页面展示图形，**so that** 我不需要手动输入函数表达式
- **As a** 移动端用户，**I want** 三个 Tab 页面切换流畅且带有动画，**so that** 体验不输原生应用
- **As a** 开发者，**I want** 使用 Skland 绿色品牌色和统一设计 Token，**so that** 应用视觉一致

---

## 3. 技术规范

### 3.1 Requirements Pool

#### P0 — Must Have（核心功能，不可妥协）

| ID | 需求 | 描述 | 验收标准 | 状态 |
|----|------|------|----------|------|
| **P0-1** | GeoGebra WebView 集成 | 使用 `iframe` (Web) / `WebView` (Android) 加载 GeoGebra 离线 HTML，启动即渲染 | 打开首页可见 GeoGebra 图形计算器，可交互（缩放/平移） | ✅ 完成 |
| **P0-2** | GeoGebra 离线资源方案 | 精简到 48MB，放入 `assets/geogebra/`，Android + Web 双平台加载 | 不依赖外部 CDN，离线可用 | ✅ 完成 |
| **P0-3** | AI 对话页面 | 接入 DeepSeek API，用户输入数学问题，AI 按系统提示词格式输出 | 发送问题后 10s 内收到格式化的回复 | 🔲 待实现 |
| **P0-4** | AI 输出解析器 | 正则解析【解题过程】【图像判断】【函数表达式】三部分 | 准确解析标准格式输出，容错处理轻微格式偏差 | 🔲 待实现 |
| **P0-5** | 三 Tab 导航结构 | `_layout.tsx` 扩展为 3 Tab（绘图 / AI 对话 / 预留） | Android + Web 均显示 3 个 Tab | 🔲 待实现 |
| **P0-6** | NativeWind 配置 | 安装 nativewind + tailwindcss，配置 tailwind.config.js，映射 Skland 设计 Token | 组件可使用 Tailwind 类名，颜色/间距/圆角/字号与 Skland 一致 | 🔲 待实现 |

#### P1 — Should Have（重要但可延后）

| ID | 需求 | 描述 | 验收标准 |
|----|------|------|----------|
| **P1-1** | GeoGebra ↔ RN 双向通信 | postMessage/onMessage + injectJavaScript 实现双向通信 | 从 AI 页面传入 `f(x) = sin(x)`，GeoGebra 正确渲染 |
| **P1-2** | AI 页面 → GeoGebra 页面跳转 | 解析出"可绘制"后，通过全局状态传递表达式，自动切换到绘图 Tab | 点击"绘图"按钮，切换到 Tab1 并渲染 |
| **P1-3** | LaTeX 公式渲染 | WebView 内嵌 KaTeX 渲染 `$...$` / `$$...$$` | 行内公式和独立公式均正确显示 |
| **P1-4** | 页面切换动画 | Tab 切换使用 react-native-reanimated | 切换流畅，60fps |
| **P1-5** | 暗色模式支持 | light/dark 双主题 | 跟随系统自动切换 |

#### P2 — Nice to Have（增强体验）

| ID | 需求 | 描述 |
|----|------|------|
| **P2-1** | 对话历史存储 | 本地 AsyncStorage 缓存最近 50 条对话 |
| **P2-2** | 函数表达式收藏 | 用户可收藏常用函数表达式 |
| **P2-3** | GeoGebra 工具栏定制 | 根据高数场景精简工具栏 |
| **P2-4** | 错误 Toast 提示 | AI 解析失败或网络错误的用户友好提示 |

### 3.2 UI Design Draft

```
┌─────────────────────────────────────┐
│  Tab Bar                            │
│  [📐 绘图] [🤖 AI对话] [📦 更多]     │
├─────────────────────────────────────┤
│  Tab 1: GeoGebra (P0) ✅            │
│  ┌─────────────────────────────┐   │
│  │  GeoGebra 图形计算器        │   │
│  │  (iframe/WebView 全屏)      │   │
│  └─────────────────────────────┘   │
│                                     │
├─────────────────────────────────────┤
│  Tab 2: AI Chat (P0)               │
│  ┌─────────────────────────────┐   │
│  │  AI 回复气泡 + KaTeX 渲染   │   │
│  │  [📐 查看图像] 按钮         │   │
│  │  用户输入框                 │   │
│  └─────────────────────────────┘   │
│                                     │
├─────────────────────────────────────┤
│  Tab 3: Placeholder                 │
│  ┌─────────────────────────────┐   │
│  │  敬请期待...                 │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### 3.3 关键技术方案决策

#### 3.3.1 GeoGebra 离线资源合并方案 ✅

**已采用方案 A**：精简至 48MB 后放入 `assets/geogebra/`。
- Web：复制到 `public/geogebra/` → Metro serve → 原生 `<iframe>` 加载
- Android：`file:///android_asset/geogebra/GeoGebra.html`（WebView）

#### 3.3.2 GeoGebra ↔ RN 双向通信

```
RN → GeoGebra (Android WebView):
  webViewRef.current.injectJavaScript(`
    ggbApplet.evalCommand('f(x) = sin(x)');
  `);

Web 端 → GeoGebra (iframe):
  iframeRef.current.contentWindow.postMessage({
    type: 'evalCommand',
    expression: 'f(x) = sin(x)'
  }, '*');
```

#### 3.3.3 LaTeX 渲染方案

WebView 内嵌 KaTeX（跨平台一致，无需原生模块）

#### 3.3.4 跨页面状态共享

React Context + useReducer 在 `_layout.tsx` 层级提供全局状态

### 3.4 依赖清单

| 包名 | 用途 | 优先级 | 状态 |
|------|------|--------|------|
| `react-native-webview` | GeoGebra WebView 容器 | P0 | ✅ 已安装 |
| `nativewind` | TailwindCSS for RN | P0 | 🔲 |
| `tailwindcss` | CSS 工具类生成 | P0 | 🔲 |
| `react-native-katex` | LaTeX 公式渲染 | P1 | 🔲 |
| `@react-native-async-storage/async-storage` | 对话历史缓存 | P2 | 🔲 |

### 3.5 文件结构规划

```
src/
├── app/
│   ├── _layout.tsx          # 修改：3 Tab + 全局状态 Provider
│   ├── index.tsx            # ✅ GeoGebra 页面（已完成）
│   ├── ai-chat.tsx          # 新增：AI 对话页面
│   └── more.tsx             # 新增：预留空页面
├── components/
│   ├── geogebra/
│   │   └── geogebra-view.tsx
│   ├── ai/
│   │   ├── chat-bubble.tsx
│   │   ├── latex-renderer.tsx
│   │   └── function-action.tsx
│   └── ui/
├── lib/
│   ├── ai-parser.ts
│   ├── api.ts
│   └── app-state.tsx
├── constants/
│   └── theme.ts             # Skland Token
├── global.css
├── tailwind.config.js
└── babel.config.js
```

### 3.6 开发进度

| 阶段 | 内容 | 状态 |
|------|------|------|
| 1 | GeoGebra 精简 + WebView/iframe 加载 | ✅ 完成 |
| 2 | 项目清理 + main 分支合并 | ✅ 完成 |
| 3 | NativeWind 环境搭建 + Skland 主题定制 | 🔲 下一步 |
| 4 | 全局状态管理 + 3 Tab 导航 | 🔲 |
| 5 | AI 对话页面 + 输出解析器 | 🔲 |
| 6 | 跨页面通信 + LaTeX 渲染 | 🔲 |

### 3.7 Open Questions

1. **DeepSeek API Key 管理**：使用 `.env` + `EXPO_PUBLIC_` 前缀，`.gitignore` 已屏蔽
2. **48MB 资源包对 APK 的影响**：可接受，后续可用 AAB 分包优化
3. **AI 对话流式输出**：DeepSeek 支持 SSE，建议实现逐字输出
4. **第三页未来方向**：待定，先做占位页面
