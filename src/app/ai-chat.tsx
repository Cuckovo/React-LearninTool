import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, KeyboardAvoidingView, Platform, Animated,
  Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import katex from 'katex';
import { useAppState, generateId, type ChatMessage, type ChatSession, type ParsedAIResponse } from '@/lib/app-state';
import { parseAIResponse, filterDBCommands } from '@/lib/ai-parser';
import { sendChatMessage, sendAssessment } from '@/lib/api';
import { GeoGebraDrawIcon, MathLanguageIcon, PushMessageIcon, HistoryIcon, NewChatIcon } from '@/constants/icons';
import { KnowledgeService } from '@/db/knowledge-service';
import { extractDBCommands, executeDBCommands } from '@/lib/db-command-parser';
import { buildKnowledgeContext } from '@/lib/knowledge-prompt';
import { dbLog } from '@/db/logger';
import ModeSwitcher from '@/components/chat/mode-switcher';
import AssessmentResultCard from '@/components/chat/assessment-result-card';
import type { ChatMode, AssessmentResult } from '@/types/knowledge';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = 280;

/** 评分触发标记 — AI 回复中包含此标记则触发 sendAssessment */
const ASSESSMENT_TRIGGER_MARKER = '[开始评分]';

/**
 * 从内容中过滤掉 [开始评分] 标记。
 * 同时移除标记所在行及前后的多余空行。
 */
function filterAssessmentMarker(content: string): string {
  let result = content.replace(ASSESSMENT_TRIGGER_MARKER, '');
  // 清理多余的空行（连续 3 个以上换行 → 2 个）
  result = result.replace(/\n{3,}/g, '\n\n');
  // 去除首尾空白
  result = result.trim();
  return result;
}

/**
 * 检测内容中是否包含 [开始评分] 标记。
 */
function hasAssessmentMarker(content: string): boolean {
  return content.includes(ASSESSMENT_TRIGGER_MARKER);
}

/* ── KaTeX 渲染 ── */

/**
 * 将文本中的 LaTeX 公式渲染为 HTML。
 * - $$...$$  → 块级公式（displayMode）
 * - $...$    → 行内公式
 *
 * Web 端返回 HTML 字符串（通过 dangerouslySetInnerHTML 渲染）。
 * Native 端也返回 HTML，通过 WebView 或 katex 渲染为文本近似。
 *
 * @param text 原始文本（可能含 LaTeX 公式）
 * @returns 包含 HTML 的字符串
 */
function renderLatex(text: string): string {
  // 使用非贪婪匹配，按顺序处理 $$...$$ 和 $...$
  // 使用一个统一的 tokenizer 来避免 $ 和 $$ 冲突
  const tokens: { type: 'text' | 'display' | 'inline'; content: string }[] = [];

  // 先用正则找到所有公式
  const combinedRegex = /(\$\$[\s\S]*?\$\$|\$(?!\$)[\s\S]*?\$(?!\$))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combinedRegex.exec(text)) !== null) {
    // 添加公式前的文本
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    const raw = match[0];
    if (raw.startsWith('$$')) {
      // 块级公式：去掉 $$ 包裹
      const latex = raw.slice(2, -2).trim();
      tokens.push({ type: 'display', content: latex });
    } else {
      // 行内公式：去掉 $ 包裹
      const latex = raw.slice(1, -1).trim();
      tokens.push({ type: 'inline', content: latex });
    }

    lastIndex = match.index + raw.length;
  }

  // 添加最后一段文本
  if (lastIndex < text.length) {
    tokens.push({ type: 'text', content: text.slice(lastIndex) });
  }

  // 如果没有找到任何公式，直接返回转义后的文本
  if (tokens.every((t) => t.type === 'text')) {
    return escapeHtml(text);
  }

  // 渲染所有 token 为 HTML
  return tokens
    .map((token) => {
      if (token.type === 'text') {
        return escapeHtml(token.content);
      }
      try {
        const isDisplay = token.type === 'display';
        return katex.renderToString(token.content, {
          throwOnError: false,
          displayMode: isDisplay,
          trust: false,
          strict: false,
        });
      } catch (err) {
        // KaTeX 渲染失败时回退到原始 LaTeX 文本
        const wrapper = token.type === 'display' ? '$$' : '$';
        return escapeHtml(wrapper + token.content + wrapper);
      }
    })
    .join('');
}

/**
 * 简单的 HTML 转义，防止 XSS。
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ── 根据最新 AI 回复提取状态 ── */
function useLatestParsed(messages: ChatMessage[]) {
  return useMemo(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistant?.parsed?.parsed) return { isPlottable: false, functionExpression: null as string | null, hasSolution: false };
    return {
      isPlottable: lastAssistant.parsed.isPlottable,
      functionExpression: lastAssistant.parsed.functionExpression,
      hasSolution: !!(lastAssistant.parsed.solution),
    };
  }, [messages]);
}

/**
 * 判断当前平台是否为 Web。
 */
function useIsWeb(): boolean {
  return Platform.OS === 'web';
}

/* ── 对话气泡 ── */
function ChatBubble({
  message,
  isKnowledgeMode,
}: {
  message: ChatMessage;
  isKnowledgeMode: boolean;
}) {
  const isUser = message.role === 'user';
  const parsed: ParsedAIResponse | undefined = message.parsed;
  const isWeb = useIsWeb();

  // 解题模式下的结构化展示
  if (!isKnowledgeMode && parsed?.parsed && parsed.solution) {
    return (
      <View className={`mb-4 ${isUser ? 'items-end' : 'items-start'}`}>
        <Text className="text-sk-text-disabled text-sk-xs mb-1">{isUser ? '你' : 'AI 助手'}</Text>
        <View className="bg-sk-surface-card rounded-sk-md px-sk-4 py-sk-3 max-w-[85%] border border-sk-border-soft">
          <Text className="text-sk-text-primary text-sk-sm mb-2 font-semibold">【解题过程】</Text>
          <RenderContent content={parsed.solution} isWeb={isWeb} />
          <Text className="text-sk-text-primary text-sk-sm mb-1 font-semibold mt-2">【图像判断】</Text>
          <Text className="text-sk-text-secondary text-sk-sm mb-3">{parsed.isPlottable ? '可绘制' : '不可绘制'}</Text>
          <Text className="text-sk-text-primary text-sk-sm mb-1 font-semibold">【函数表达式】</Text>
          <Text className="text-sk-text-secondary text-sk-sm mb-3 font-mono">{parsed.functionExpression ?? '无'}</Text>
        </View>
      </View>
    );
  }

  // 普通气泡（含知识库模式）
  return (
    <View className={`mb-4 ${isUser ? 'items-end' : 'items-start'}`}>
      <Text className="text-sk-text-disabled text-sk-xs mb-1">{isUser ? '你' : 'AI 助手'}</Text>
      <View className={`rounded-sk-md px-sk-4 py-sk-3 max-w-[85%] ${isUser ? 'bg-brand' : 'bg-sk-surface-card border border-sk-border-soft'}`}>
        {isUser ? (
          <Text className="text-sk-sm text-white">{message.content}</Text>
        ) : (
          <RenderContent content={message.content} isWeb={isWeb} />
        )}
      </View>
    </View>
  );
}

/**
 * 渲染支持 KaTeX 的内容。
 *
 * Web 端：使用 dangerouslySetInnerHTML 注入 KaTeX HTML。
 * Native 端：由于 react-native 没有原生 HTML 渲染，
 *   使用 Text 组件显示，但先将 LaTeX 公式替换为可读的 Unicode 近似。
 */
function RenderContent({ content, isWeb }: { content: string; isWeb: boolean }) {
  if (isWeb) {
    const html = renderLatex(content);
    // react-native-web 中 dangerouslySetInnerHTML 需要在特定元素上
    // 我们使用一个简单的 span/div 包装
    return (
      <span
        className="text-sk-sm text-sk-text-primary katex-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // Native 端：使用 react-native-webview 来渲染 KaTeX HTML
  // 构建一个完整的 HTML 页面来渲染公式
  const formulaHtml = renderLatex(content);
  const fullHtml = buildKatexHtmlPage(formulaHtml);

  return (
    <View style={{ minHeight: 24 }}>
      <NativeKatexRenderer html={fullHtml} />
      {/* 降级方案：同时显示纯文本，确保 WebView 无法加载时仍有内容 */}
      <Text className="text-sk-sm text-sk-text-primary" style={{ opacity: 0 }}>
        {content.replace(/\$\$?/g, '').slice(0, 50)}
      </Text>
    </View>
  );
}

/**
 * 构建包含 KaTeX 渲染内容的完整 HTML 页面。
 */
function buildKatexHtmlPage(bodyHtml: string): string {
  // 使用 CDN 加载 KaTeX CSS，确保 WebView 中公式样式正确
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<style>
  body {
    margin: 0;
    padding: 8px 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: #222222;
    background: transparent;
  }
  .katex { font-size: 1.1em; }
  .katex-display { margin: 1em 0; }
  .katex-display > .katex { font-size: 1.2em; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

/**
 * Native 端的 KaTeX 渲染组件。
 * 使用 WebView 渲染包含 KaTeX HTML 的内容。
 * 通过 onMessage 获取渲染后的高度，动态调整 WebView 大小。
 */
function NativeKatexRenderer({ html }: { html: string }) {
  const [height, setHeight] = useState(30);
  // 使用 useRef 防止不必要的重新渲染
  const htmlRef = useRef(html);

  // 仅在 HTML 内容变化时更新
  useEffect(() => {
    htmlRef.current = html;
  }, [html]);

  // 动态导入 WebView（避免在 Web 端导入原生模块）
  const WebViewComponent = useMemo(() => {
    if (Platform.OS === 'web') return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { WebView } = require('react-native-webview');
      return WebView;
    } catch {
      return null;
    }
  }, []);

  if (!WebViewComponent) {
    // 降级方案：显示纯文本（去掉 LaTeX 标记）
    const fallback = html.replace(/<[^>]*>/g, '').slice(0, 200);
    return <Text className="text-sk-sm text-sk-text-primary">{fallback || '(公式)'}</Text>;
  }

  // 注入 JS 用于在内容加载后获取实际高度
  const injectedJs = `
    setTimeout(function() {
      var h = document.body.scrollHeight;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', value: h }));
    }, 100);
    true;
  `;

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'height' && typeof data.value === 'number') {
        setHeight(Math.max(data.value + 16, 24));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  return (
    <View style={{ height, minHeight: 24 }}>
      <WebViewComponent
        source={{ html: htmlRef.current }}
        style={{ height, backgroundColor: 'transparent' }}
        scrollEnabled={false}
        javaScriptEnabled={true}
        injectedJavaScript={injectedJs}
        onMessage={handleMessage}
        originWhitelist={['*']}
        scalesPageToFit={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

/* ── 左侧滑出历史面板 ── */
function HistoryDrawer({
  visible,
  sessions,
  activeSessionId,
  onClose,
  onSwitch,
  onDelete,
  onNew,
}: {
  visible: boolean;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onClose: () => void;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -DRAWER_WIDTH, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View className="absolute inset-0 z-50" style={{ flexDirection: 'row' }}>
      {/* 遮罩 + 点击关闭 */}
      <Animated.View
        className="absolute inset-0 bg-black/50"
        style={{ opacity: fadeAnim }}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableOpacity className="flex-1" activeOpacity={1} onPress={onClose} />
      </Animated.View>

      {/* 左侧面板 */}
      <Animated.View
        className="h-full shadow-2xl z-10"
        style={{
          width: DRAWER_WIDTH,
          transform: [{ translateX: slideAnim }],
          backgroundColor: '#ffffff',
        }}
      >
        {/* 头部 — 右上角关闭按钮 */}
        <View className="flex-row justify-between items-center px-sk-4 py-sk-3 border-b border-sk-border-soft">
          <Text className="text-sk-text-primary text-sk-md font-semibold">历史对话</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} className="p-1">
            <NewChatIcon size={18} color="rgba(34,34,34,0.4)" style={{ transform: [{ rotate: '45deg' }] }} />
          </TouchableOpacity>
        </View>

        {/* 列表 */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {sessions.length === 0 ? (
            <View className="py-sk-8 items-center">
              <Text className="text-sk-text-disabled text-sk-sm">暂无对话记录</Text>
              <Text className="text-sk-text-disabled text-sk-xs mt-1">发送第一条消息开始</Text>
            </View>
          ) : (
            sessions.map((s) => {
              const isActive = s.id === activeSessionId;
              const sessionType = (s as ChatSession).type ?? 'solver';
              const typeIcon = sessionType === 'knowledge' ? '📖' : '📐';
              return (
                <TouchableOpacity
                  key={s.id}
                  className={`px-sk-4 py-sk-3 border-b border-sk-border-soft flex-row items-center ${isActive ? 'bg-brand/10' : ''}`}
                  onPress={() => { onSwitch(s.id); onClose(); }}
                  activeOpacity={0.7}
                  onLongPress={() => onDelete(s.id)}
                >
                  <Text className="text-sk-sm mr-2">{typeIcon}</Text>
                  <View className="flex-1 mr-2">
                    <Text
                      className={`text-sk-sm ${isActive ? 'text-brand font-semibold' : 'text-sk-text-primary'}`}
                      numberOfLines={1}
                    >
                      {s.title || '新对话'}
                    </Text>
                    <Text className="text-sk-text-tertiary text-sk-xs mt-1">
                      {s.messages.length} 条消息 · {new Date(s.updatedAt).toLocaleDateString('zh-CN')}
                    </Text>
                  </View>
                  {isActive && <View className="w-2 h-2 rounded-full bg-brand" />}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

/* ── 主页面 ── */
export default function AIChatScreen() {
  const { state, dispatch, currentMessages } = useAppState();
  const { sessions, activeSessionId, isLoading, activeChatMode, activeKnowledgeNodeId } = state;
  const [input, setInput] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();

  // 知识库模式特定状态
  const [knowledgeNodeContext, setKnowledgeNodeContext] = useState<{
    nodeId: string;
    nodeLabel: string;
    standardDefinition: string | null;
  } | null>(null);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null);

  const knowledgeService = useRef(new KnowledgeService()).current;

  const { isPlottable, functionExpression, hasSolution } = useLatestParsed(currentMessages);
  const hasMessages = currentMessages.length > 0;
  const canSend = !!input.trim() && !isLoading;
  const isKnowledgeMode = activeChatMode === 'knowledge';

  // 从知识库跳转时加载节点上下文
  useEffect(() => {
    if (isKnowledgeMode && activeKnowledgeNodeId && !knowledgeNodeContext) {
      (async () => {
        const node = await knowledgeService.getNode(activeKnowledgeNodeId);
        if (node) {
          setKnowledgeNodeContext({
            nodeId: node.id,
            nodeLabel: node.label,
            standardDefinition: node.standardDefinition,
          });
        }
      })();
    }
  }, [isKnowledgeMode, activeKnowledgeNodeId, knowledgeNodeContext]);

  // 清除考核结果（新用户消息时）
  useEffect(() => {
    if (assessmentResult && currentMessages.length > 0) {
      const lastMsg = currentMessages[currentMessages.length - 1];
      if (lastMsg.role === 'user') {
        setAssessmentResult(null);
      }
    }
  }, [currentMessages, assessmentResult]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const handleViewPlot = useCallback(() => {
    if (!functionExpression) return;
    dispatch({ type: 'SEND_PLOT_COMMAND', payload: { expression: functionExpression, timestamp: Date.now() } });
    router.navigate('/');
  }, [functionExpression, dispatch, router]);

  const handleShareProcess = useCallback(() => {
    const lastAssistant = [...currentMessages].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistant?.parsed?.parsed) return;
    const text = `【解题过程】\n${lastAssistant.parsed.solution}\n\n【函数表达式】\n${lastAssistant.parsed.functionExpression ?? '无'}`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => alert('已复制到剪贴板'));
    }
  }, [currentMessages]);

  const handleNewChat = useCallback(() => {
    dispatch({ type: 'NEW_SESSION' });
    setKnowledgeNodeContext(null);
    setAssessmentResult(null);
  }, [dispatch]);

  const handleSwitchSession = useCallback((id: string) => {
    dispatch({ type: 'SWITCH_SESSION', payload: id });
    setKnowledgeNodeContext(null);
    setAssessmentResult(null);
  }, [dispatch]);

  const handleDeleteSession = useCallback((id: string) => {
    dispatch({ type: 'DELETE_SESSION', payload: id });
  }, [dispatch]);

  const handleSwitchMode = useCallback((mode: ChatMode) => {
    dispatch({ type: 'SET_CHAT_MODE', payload: mode });
    setKnowledgeNodeContext(null);
    setAssessmentResult(null);
  }, [dispatch]);

  /**
   * 执行考核评分。
   *
   * 接收 AI 刚出的题目内容（assistantReplyContent）和用户的回答（userAnswerContent），
   * 调用 sendAssessment API 进行评分。
   *
   * @param assistantReplyContent AI 评分回复的完整内容（即触发了[开始评分]的那条 AI 消息）
   * @param userAnswerContent 用户的回答文本
   */
  const doAssessment = useCallback(async (
    assistantReplyContent: string,
    userAnswerContent: string,
  ) => {
    if (!knowledgeNodeContext) {
      dbLog.warn('doAssessment: knowledgeNodeContext 为空，跳过评分');
      return;
    }

    dbLog.info('doAssessment: 开始考核评分...');
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const result = await sendAssessment(
        knowledgeNodeContext.standardDefinition,
        [assistantReplyContent],
        [userAnswerContent],
      );

      if (result) {
        dbLog.info(`doAssessment: 评分=${result.score}, passed=${result.passed}`);
        setAssessmentResult(result);

        // 更新掌握状态
        const newMastery = result.passed ? 'passed' : 'learning';
        dbLog.info(`doAssessment: 更新掌握状态为 ${newMastery}`);
        if (result.passed) {
          await knowledgeService.updateMastery(knowledgeNodeContext.nodeId, 'passed');
        } else {
          await knowledgeService.updateMastery(knowledgeNodeContext.nodeId, 'learning');
        }

        // 保存 AI 建议的笔记到知识库
        if (result.suggestedUserNote) {
          dbLog.info(`doAssessment: 保存建议笔记, 长度=${result.suggestedUserNote.length}`);
          await knowledgeService.setUserNotes(knowledgeNodeContext.nodeId, result.suggestedUserNote);
        }
      } else {
        dbLog.warn('doAssessment: 评分结果解析失败');
      }
    } catch (err) {
      dbLog.error('doAssessment: 考核评分失败', err);
      setErrorText(err instanceof Error ? err.message : '考核评分失败，请重试');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [knowledgeNodeContext, dispatch, knowledgeService]);

  /**
   * handleSend — 发送消息主流程。
   *
   * 两阶段考核流程：
   * 1. 用户发送消息 → 调用 DeepSeek API
   * 2. 收到 AI 回复 → 检测 [开始评分] 标记
   *    - 有标记 → 调用 doAssessment() 评分
   *    - 无标记 → 正常展示回复
   */
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    setErrorText(null);

    const userMsg: ChatMessage = { id: generateId(), role: 'user', content: text, timestamp: Date.now() };
    dispatch({ type: 'ADD_MESSAGE', payload: userMsg });
    dispatch({ type: 'SET_LOADING', payload: true });
    scrollToBottom();

    // 需要获取最新的 messages（含刚加的 userMsg）
    const currentForApi = [...currentMessages, userMsg];

    try {
      let reply: string;

      if (isKnowledgeMode) {
        // 知识库模式 — 构建节点上下文
        let nodeContextSysMsg: string | undefined;
        if (knowledgeNodeContext) {
          // 查询当前 mastery 状态
          const node = await knowledgeService.getNode(knowledgeNodeContext.nodeId);
          nodeContextSysMsg = buildKnowledgeContext(
            knowledgeNodeContext.nodeId,
            knowledgeNodeContext.nodeLabel,
            knowledgeNodeContext.standardDefinition,
            node?.masteryStatus ?? 'not_started',
          );
        }

        reply = await sendChatMessage(currentForApi, {
          mode: 'knowledge',
          nodeContextSystemMessage: nodeContextSysMsg,
        });

        // 提取并执行 DB 指令
        dbLog.info('AI 回复已收到，检查 DB 指令...');
        const dbCommands = extractDBCommands(reply);
        dbLog.info(`AI 回复中包含 ${dbCommands.length} 条 DB 指令`);
        if (dbCommands.length > 0) {
          const results = await executeDBCommands(knowledgeService, dbCommands);
          dbLog.info('DB 指令执行结果:', results);
          // 更新本地节点上下文中的 mastery 状态
          for (const cmd of dbCommands) {
            if (cmd.action === 'set_mastery' && cmd.value) {
              const node = await knowledgeService.getNode(cmd.nodeId);
              if (node && knowledgeNodeContext && node.id === knowledgeNodeContext.nodeId) {
                setKnowledgeNodeContext({ ...knowledgeNodeContext });
              }
            }
          }
        }

        // 过滤 DB 代码块
        let displayContent = filterDBCommands(reply);

        // 检测 [开始评分] 标记
        const shouldAssess = hasAssessmentMarker(reply);
        dbLog.info(`AI 回复中${shouldAssess ? '包含' : '不包含'}[开始评分] 标记`);

        // 从展示内容中移除 [开始评分] 标记
        displayContent = filterAssessmentMarker(displayContent);

        const aiMsg: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: displayContent,
          timestamp: Date.now(),
        };
        dispatch({ type: 'ADD_MESSAGE', payload: aiMsg });
        dispatch({ type: 'SET_LOADING', payload: false });
        scrollToBottom();

        // 如果 AI 回复包含 [开始评分] 标记，自动触发评分
        if (shouldAssess) {
          dbLog.info('检测到 [开始评分] 标记，触发考核评分...');
          // 使用过滤后的 AI 回复内容（移除标记）作为题目上下文
          // 使用当前用户消息作为回答
          const cleanReply = filterAssessmentMarker(reply);
          doAssessment(cleanReply, text);
        }
      } else {
        // 解题模式 — 保持原有逻辑
        reply = await sendChatMessage(currentForApi, { mode: 'solver' });
        const parsed = parseAIResponse(reply);
        const aiMsg: ChatMessage = { id: generateId(), role: 'assistant', content: reply, parsed, timestamp: Date.now() };
        dispatch({ type: 'ADD_MESSAGE', payload: aiMsg });
        dispatch({ type: 'SET_LOADING', payload: false });
        scrollToBottom();
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : '未知错误，请重试');
      dispatch({ type: 'SET_LOADING', payload: false });
      scrollToBottom();
    }
  }, [input, isLoading, currentMessages, dispatch, scrollToBottom, isKnowledgeMode, knowledgeNodeContext, knowledgeService, doAssessment]);

  // 欢迎语
  const welcomeText = isKnowledgeMode
    ? '欢迎使用知识库学习模式'
    : '欢迎使用 AI 数学助手';
  const welcomeSubtext = isKnowledgeMode
    ? knowledgeNodeContext
      ? `当前学习：${knowledgeNodeContext.nodeLabel}`
      : '从知识库选择一个知识点开始学习，或直接输入你的问题。'
    : '输入高等数学问题，我将为你分步解题并提供函数图像。';

  return (
    <SafeAreaView className="flex-1 bg-sk-surface-page">
      <KeyboardAvoidingView
        className="flex-1 bg-sk-surface-page"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      {/* 标题栏：左侧历史按钮 + 中间模式指示 + 右侧新建会话 */}
      <View className="bg-sk-surface-card px-sk-4 py-sk-3 border-b border-sk-border-soft flex-row justify-between items-center">
        <TouchableOpacity
          className="flex-row items-center gap-2"
          onPress={() => setHistoryVisible(true)}
          activeOpacity={0.7}
        >
          <HistoryIcon size={20} color="rgba(34,34,34,0.7)" />
          <Text className="text-sk-text-secondary text-sk-sm">历史对话</Text>
        </TouchableOpacity>

        {/* 模式指示 */}
        <View className="flex-row items-center">
          <Text className="text-sk-sm mr-1">{isKnowledgeMode ? '📖' : '📐'}</Text>
          <Text className="text-sk-text-tertiary text-sk-xs">
            {isKnowledgeMode ? '知识库学习' : '解题模式'}
          </Text>
        </View>

        <TouchableOpacity onPress={handleNewChat} activeOpacity={0.7} className="p-1">
          <NewChatIcon size={20} color="rgba(34,34,34,0.7)" />
        </TouchableOpacity>
      </View>

      {/* 左侧滑出历史面板 */}
      <HistoryDrawer
        visible={historyVisible}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onClose={() => setHistoryVisible(false)}
        onSwitch={handleSwitchSession}
        onDelete={handleDeleteSession}
        onNew={() => { handleNewChat(); setHistoryVisible(false); }}
      />

      {/* 对话列表 */}
      {hasMessages ? (
        <FlatList
          ref={flatListRef}
          data={currentMessages}
          keyExtractor={(item, index) => `${item.id}_${index}`}
          renderItem={({ item }) => <ChatBubble message={item} isKnowledgeMode={isKnowledgeMode} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 8 }}
          onContentSizeChange={() => scrollToBottom()}
          onLayout={() => scrollToBottom()}
          ListFooterComponent={
            assessmentResult ? (
              <AssessmentResultCard result={assessmentResult} />
            ) : null
          }
        />
      ) : (
        <View className="flex-1 justify-center items-center px-sk-8">
          <Text className="text-sk-text-tertiary text-sk-lg mb-2">{welcomeText}</Text>
          <Text className="text-sk-text-disabled text-sk-sm text-center leading-5">
            {welcomeSubtext}
          </Text>
          {isKnowledgeMode && knowledgeNodeContext && (
            <View className="mt-4 bg-sk-surface-card rounded-sk-md px-sk-4 py-sk-3 border border-sk-border-soft max-w-[90%]">
              <Text className="text-sk-text-secondary text-sk-xs font-semibold mb-1">当前知识点</Text>
              <Text className="text-sk-text-primary text-sk-sm">{knowledgeNodeContext.nodeLabel}</Text>
            </View>
          )}
        </View>
      )}

      {/* 加载指示器 */}
      {isLoading && (
        <View className="flex-row items-center justify-center py-2 bg-sk-surface-page">
          <ActivityIndicator size="small" color="#90c208" />
          <Text className="text-sk-text-tertiary text-sk-sm ml-2">AI 正在思考...</Text>
        </View>
      )}

      {/* 错误提示 */}
      {errorText && (
        <View className="px-sk-4 py-2 bg-sk-function-error/10">
          <Text className="text-sk-function-error text-sk-xs">{errorText}</Text>
        </View>
      )}

      {/* 操作按钮列表 — 输入框上方 */}
      <View className="flex-row justify-end gap-2 px-sk-4 py-2 bg-sk-surface-page border-t border-sk-border-soft">
        {/* 解题模式专属按钮 */}
        {!isKnowledgeMode && (
          <>
            <TouchableOpacity
              className={`flex-row items-center gap-1 rounded-sk-sm px-sk-3 py-1.5 border ${isPlottable ? 'border-sk-border-brand' : 'border-sk-border-soft'}`}
              onPress={handleViewPlot}
              disabled={!isPlottable}
              activeOpacity={0.7}
            >
              <GeoGebraDrawIcon size={14} color={isPlottable ? '#90c208' : 'rgba(34,34,34,0.25)'} />
              <Text className={`text-sk-xs font-semibold ${isPlottable ? 'text-brand' : 'text-sk-text-disabled'}`}>绘制图像</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-row items-center gap-1 rounded-sk-sm px-sk-3 py-1.5 border ${hasSolution ? 'border-sk-border-brand' : 'border-sk-border-soft'}`}
              onPress={handleShareProcess}
              disabled={!hasSolution}
              activeOpacity={0.7}
            >
              <MathLanguageIcon size={14} color={hasSolution ? '#90c208' : 'rgba(34,34,34,0.25)'} />
              <Text className={`text-sk-xs font-semibold ${hasSolution ? 'text-brand' : 'text-sk-text-disabled'}`}>分享过程</Text>
            </TouchableOpacity>
          </>
        )}

        {/* 模式切换按钮 — 两种模式都显示 */}
        <ModeSwitcher
          currentMode={activeChatMode}
          onSwitch={handleSwitchMode}
          disabled={isLoading}
        />
      </View>

      {/* 输入区域 */}
      <View className="bg-sk-surface-card border-t border-sk-border-soft px-sk-4 py-sk-3">
        <View className="flex-row items-center">
          <TextInput
            className="flex-1 bg-sk-surface-page rounded-sk-sm px-sk-3 py-2.5 text-sk-text-primary text-sk-sm"
            placeholder={isKnowledgeMode ? '输入你的问题...' : '输入数学问题...'}
            placeholderTextColor="rgba(34,34,34,0.25)"
            value={input}
            onChangeText={setInput}
            multiline
            editable={!isLoading}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit
          />
          <TouchableOpacity
            className={`ml-3 w-10 h-10 rounded-sk-sm items-center justify-center ${canSend ? 'bg-brand' : 'bg-sk-border-default'}`}
            onPress={handleSend}
            disabled={!canSend}
            activeOpacity={0.7}
          >
            <PushMessageIcon size={18} color={canSend ? '#ffffff' : 'rgba(255,255,255,0.6)'} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}