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
| **当前状态** | Expo 默认模板，2 个 Tab（Home / Explore），使用 NativeTabs（native）+ Tabs（web） |

### 原始需求复述

构建一个三页面数学学习工具应用：
1. **首页**：GeoGebra 数学图形计算器（WebView 加载约 80MB 离线资源包）
2. **第二页**：DeepSeek AI 高等数学对话，AI 按固定格式输出，解析后可将函数表达式发送到 GeoGebra 页面绘图
3. **第三页**：预留空页面，后续扩展

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

| ID | 需求 | 描述 | 验收标准 |
|----|------|------|----------|
| **P0-1** | GeoGebra WebView 集成 | 使用 react-native-webview 加载 GeoGebra 离线 HTML，启动即渲染 | 打开首页可见 GeoGebra 图形计算器，可交互（缩放/平移） |
| **P0-2** | GeoGebra 离线资源方案 | 约 80MB geogebra-math-apps-bundle 与项目整合，Android + Web 均可加载 | 不依赖外部 CDN，离线可用 |
| **P0-3** | AI 对话页面 | 接入 DeepSeek API，用户输入数学问题，AI 按系统提示词格式输出 | 发送问题后 10s 内收到格式化的回复 |
| **P0-4** | AI 输出解析器 | 正则解析【解题过程】【图像判断】【函数表达式】三部分 | 准确解析标准格式输出，容错处理轻微格式偏差 |
| **P0-5** | 三 Tab 导航结构 | 调整 _layout.tsx，从 2 Tab 扩展为 3 Tab（绘图 / AI 对话 / 预留） | Android NativeTabs + Web Tabs 均显示 3 个 Tab |
| **P0-6** | NativeWind 配置 | 安装 nativewind + tailwindcss，配置 tailwind.config.js，映射 Skland 设计 Token | 组件可使用 Tailwind 类名，颜色/间距/圆角/字号与 Skland 一致 |

#### P1 — Should Have（重要但可延后）

| ID | 需求 | 描述 | 验收标准 |
|----|------|------|----------|
| **P1-1** | GeoGebra ↔ RN 双向通信 | postMessage/onMessage 实现：RN → GeoGebra（发送函数表达式绘图），GeoGebra → RN（绘图完成确认） | 从 AI 页面传入 `f(x) = sin(x)`，GeoGebra 正确渲染 |
| **P1-2** | AI 页面 → GeoGebra 页面跳转 | 解析出"可绘制"后，通过全局状态/路由参数传递表达式，自动切换到绘图 Tab | 点击 AI 回复中的"绘图"按钮，切换到 Tab1 并渲染 |
| **P1-3** | LaTeX 公式渲染 | 解题过程中的 `$...$` 和 `$$...$$` 公式渲染为数学公式 | 行内公式和独立公式均正确显示 |
| **P1-4** | 页面切换动画 | Tab 切换使用 react-native-reanimated 实现 translateX 滑动动画 | 切换流畅，60fps |
| **P1-5** | 暗色模式支持 | 基于 Skland 设计体系，支持 light/dark 双主题 | 跟随系统自动切换 |

#### P2 — Nice to Have（增强体验）

| ID | 需求 | 描述 |
|----|------|------|
| **P2-1** | 对话历史存储 | 本地 AsyncStorage 缓存最近 50 条对话 |
| **P2-2** | 函数表达式收藏 | 用户可收藏常用函数表达式，快速在 GeoGebra 中加载 |
| **P2-3** | GeoGebra 工具栏定制 | 根据高数场景精简 GeoGebra 默认工具栏 |
| **P2-4** | 错误 Toast 提示 | AI 解析失败或网络错误时的用户友好提示 |

### 3.2 UI Design Draft

```
┌─────────────────────────────────────┐
│  Tab Bar (NativeTabs / Web Tabs)     │
│  [📐 绘图] [🤖 AI对话] [📦 更多]     │
├─────────────────────────────────────┤
│                                     │
│  Tab 1: GeoGebra (P0)              │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │   GeoGebra WebView          │   │
│  │   (全屏，含工具栏)           │   │
│  │                             │   │
│  │   - 代数区 / 绘图区          │   │
│  │   - 函数输入栏 (可选)        │   │
│  │   - 缩放/平移手势            │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│  底部：从 AI 页面传入的表达式提示    │
│                                     │
├─────────────────────────────────────┤
│  Tab 2: AI Chat (P0)               │
│  ┌─────────────────────────────┐   │
│  │  AI 回复气泡                │   │
│  │  ┌───────────────────────┐  │   │
│  │  │ 【解题过程】           │  │   │
│  │  │ $f'(x)=...$           │  │   │
│  │  │ (KaTeX 渲染)          │  │   │
│  │  │                       │  │   │
│  │  │ 【图像判断】           │  │   │
│  │  │ 可绘制                │  │   │
│  │  │                       │  │   │
│  │  │ 【函数表达式】         │  │   │
│  │  │ f(x) = sin(x)         │  │   │
│  │  │                       │  │   │
│  │  │ [📐 查看图像] ← 按钮   │  │   │
│  │  └───────────────────────┘  │   │
│  │                             │   │
│  │  用户输入框                  │   │
│  │  [输入数学问题...] [发送]    │   │
│  └─────────────────────────────┘   │
│                                     │
├─────────────────────────────────────┤
│  Tab 3: Placeholder (P2)           │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │   敬请期待...                │   │
│  │   后续功能扩展预留            │   │
│  │                             │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

#### 关键 UI 交互说明

- **AI 回复气泡**：当【图像判断】为"可绘制"时，在【函数表达式】下方显示品牌色按钮 `[📐 查看图像]`
- **点击"查看图像"**：将 `f(x) = 表达式` 写入全局共享状态 → 切换到 Tab 1 → GeoGebra WebView 通过 injectJavaScript 接收表达式并绘图
- **LaTeX 区域**：使用 KaTeX 渲染（react-native-katex 或 WebView 内嵌 KaTeX），`$...$` 行内显示，`$$...$$` 独立居中显示
- **品牌色应用**：主按钮 bg=#90c208，hover=#c8eb21，文字=#222（Skland 规范）
- **错误态**：AI 请求失败时显示 Skland 风格的 alert-danger 组件

### 3.3 关键技术方案决策

#### 3.3.1 GeoGebra 离线资源合并方案

| 方案 | 描述 | 优点 | 缺点 | 推荐 |
|------|------|------|------|------|
| **A: assets 内嵌** | 将 80MB bundle 放入 `assets/geogebra/`，通过 `require()` 或 file URI 加载 | 简单直接 | 增大 APK 体积；Web 端需配置静态资源路径 | ⭐ **推荐** |
| **B: expo-asset 下载** | 首次启动从 CDN 下载并缓存到文件系统 | 安装包小 | 首次启动需网络；下载体验差 | 备选 |
| **C: expo-modules 原生** | 编写 native module 预置资源到 app bundle | 原生性能 | 开发成本高 | 不推荐 |

**建议**：采用方案 A，将 GeoGebra 离线包放入 `assets/geogebra/`，Android 通过 `file:///android_asset/` 加载，Web 通过静态资源路径加载。需在 `app.json` 中配置 asset 打包规则。

#### 3.3.2 GeoGebra ↔ RN 双向通信

```
RN → GeoGebra:
  webViewRef.current.injectJavaScript(`
    ggbApplet.setValue('f(x) = sin(x)');
    ggbApplet.evalCommand('f(x) = sin(x)');
  `);

GeoGebra → RN:
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'geogebra:loaded',
    data: { ready: true }
  }));
```

#### 3.3.3 LaTeX 渲染方案

**推荐**：先用 react-native-katex（轻量），覆盖率不足时对 Web 端降级为 WebView 内嵌 KaTeX。需要 react-native-katex 至少覆盖 Android 端。

#### 3.3.4 跨页面状态共享

使用 React Context + useReducer 在 `_layout.tsx` 层级提供全局状态：

```typescript
interface AppState {
  functionExpression: string | null;  // 当前要绘制的函数
  geogebraReady: boolean;
}
```

AI 页面 dispatch `{ type: 'SET_FUNCTION', payload: 'f(x) = sin(x)' }`，GeoGebra 页面 useEffect 监听变化后 injectJavaScript。

#### 3.3.5 AI 输出解析器

```typescript
interface ParsedResponse {
  solution: string;         // 【解题过程】
  isDrawable: boolean;      // true = 可绘制
  functionExpr: string | null; // f(x) = sin(x) 或 null
}

function parseAIResponse(text: string): ParsedResponse {
  // 正则提取三段，容错处理换行/空格差异
  // 解析失败时 isDrawable = false，静默降级为纯文本展示
}
```

### 3.4 依赖清单（需新增）

| 包名 | 用途 | 优先级 |
|------|------|--------|
| `nativewind` | TailwindCSS for RN | P0 |
| `tailwindcss` | CSS 工具类生成 | P0 |
| `react-native-webview` | GeoGebra WebView 容器 | P0 |
| `react-native-katex` | LaTeX 公式渲染 | P1 |
| `@react-native-async-storage/async-storage` | 对话历史缓存 | P2 |

### 3.5 文件结构规划

```
src/
├── app/
│   ├── _layout.tsx          # 修改：3 Tab + 全局状态 Provider
│   ├── index.tsx            # 重写：GeoGebra WebView 页面
│   ├── ai-chat.tsx          # 新增：AI 对话页面
│   └── more.tsx             # 新增：预留空页面
├── components/
│   ├── geogebra/
│   │   └── geogebra-view.tsx # GeoGebra WebView 封装组件
│   ├── ai/
│   │   ├── chat-bubble.tsx   # 对话气泡组件
│   │   ├── latex-renderer.tsx # LaTeX 渲染组件
│   │   └── function-action.tsx # "查看图像"按钮组件
│   └── ui/                   # 保留现有通用组件
├── lib/
│   ├── ai-parser.ts          # AI 输出解析器
│   ├── api.ts                # DeepSeek API 调用
│   └── app-state.tsx         # 全局状态 Context
├── constants/
│   └── theme.ts              # 修改：映射 Skland Token
├── assets/
│   └── geogebra/             # GeoGebra 离线资源 (约 80MB)
├── global.css                # 修改：添加 Tailwind 指令 + Skland 变量
├── tailwind.config.js        # 新增：NativeWind + Skland Token
└── babel.config.js           # 新增：nativewind plugin
```

### 3.6 Open Questions

1. **GeoGebra 离线资源合法性**：geogebra-math-apps-bundle-5-4-925-3 的许可协议是否允许嵌入移动应用？需确认 GPL/CC 条款。
2. **DeepSeek API Key 管理**：API Key 如何安全存储？是否需要自建 Proxy 服务避免前端暴露？
3. **80MB 资源包对 Android APK 的影响**：APK 体积增大约 80MB 是否可接受？是否需要 AAB 分包策略？
4. **GeoGebra WebView 在 Android WebView 的兼容性**：GeoGebra 5.x 基于 Java Applet 技术，在 WebView 中是否有已知问题？是否需降级到 GeoGebra 6.x（JS 版）？
5. **AI 对话流式输出**：DeepSeek 是否支持 SSE streaming？用户是否需要看到逐字输出？
6. **第三页（预留）的未来方向**：是数学公式编辑器、题库浏览、还是视频讲解？影响路由命名和占位设计。
