import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, KeyboardAvoidingView, Platform, Animated,
  Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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

  // 解题模式下的结构化展示
  if (!isKnowledgeMode && parsed?.parsed && parsed.solution) {
    return (
      <View className={`mb-4 ${isUser ? 'items-end' : 'items-start'}`}>
        <Text className="text-sk-text-disabled text-sk-xs mb-1">{isUser ? '你' : 'AI 助手'}</Text>
        <View className="bg-sk-surface-card rounded-sk-md px-sk-4 py-sk-3 max-w-[85%] border border-sk-border-soft">
          <Text className="text-sk-text-primary text-sk-sm mb-2 font-semibold">【解题过程】</Text>
          <Text className="text-sk-text-secondary text-sk-sm leading-6 mb-3">{parsed.solution}</Text>
          <Text className="text-sk-text-primary text-sk-sm mb-1 font-semibold">【图像判断】</Text>
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
        <Text className={`text-sk-sm ${isUser ? 'text-white' : 'text-sk-text-primary'}`}>{message.content}</Text>
      </View>
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

  // 清除考核结果（新消息时）
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

        // 过滤 DB 代码块后展示
        const displayContent = filterDBCommands(reply);
        const aiMsg: ChatMessage = { id: generateId(), role: 'assistant', content: displayContent, timestamp: Date.now() };
        dispatch({ type: 'ADD_MESSAGE', payload: aiMsg });

        // 检测「考考我」→ 考核阶段标记（AI 出题后等待用户回答）
        // 注意：实际考核触发由 handleSend 内部处理 — 当用户回答后连续调用 sendAssessment
      } else {
        // 解题模式 — 保持原有逻辑
        reply = await sendChatMessage(currentForApi, { mode: 'solver' });
        const parsed = parseAIResponse(reply);
        const aiMsg: ChatMessage = { id: generateId(), role: 'assistant', content: reply, parsed, timestamp: Date.now() };
        dispatch({ type: 'ADD_MESSAGE', payload: aiMsg });
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : '未知错误，请重试');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      scrollToBottom();
    }
  }, [input, isLoading, currentMessages, dispatch, scrollToBottom, isKnowledgeMode, knowledgeNodeContext, knowledgeService]);

  // 考核评分处理
  const handleAssessment = useCallback(async () => {
    if (!knowledgeNodeContext) return;

    // 收集最近的 AI 题目和用户回答
    // 简化方案：取最后一条 assistant 消息作为题目，最后一条 user 消息作为回答
    const recentMessages = [...currentMessages];
    const lastUserMsg = [...recentMessages].reverse().find((m) => m.role === 'user');
    const lastAssistantMsg = [...recentMessages].reverse().find((m) => m.role === 'assistant');

    if (!lastUserMsg || !lastAssistantMsg) return;

    dbLog.info('handleAssessment: 开始考核评分...');
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const result = await sendAssessment(
        knowledgeNodeContext.standardDefinition,
        [lastAssistantMsg.content],
        [lastUserMsg.content],
      );

      if (result) {
        dbLog.info(`handleAssessment: 评分=${result.score}, passed=${result.passed}`);
        setAssessmentResult(result);

        // 更新掌握状态
        const newMastery = result.passed ? 'passed' : 'learning';
        dbLog.info(`handleAssessment: 更新掌握状态为 ${newMastery}`);
        if (result.passed) {
          await knowledgeService.updateMastery(knowledgeNodeContext.nodeId, 'passed');
        } else {
          await knowledgeService.updateMastery(knowledgeNodeContext.nodeId, 'learning');
        }

        // 保存 AI 建议的笔记到知识库
        if (result.suggestedUserNote) {
          dbLog.info(`handleAssessment: 保存建议笔记, 长度=${result.suggestedUserNote.length}`);
          await knowledgeService.setUserNotes(knowledgeNodeContext.nodeId, result.suggestedUserNote);
        }

        // 更新节点上下文
        const updatedNode = await knowledgeService.getNode(knowledgeNodeContext.nodeId);
        if (updatedNode) {
          setKnowledgeNodeContext({
            ...knowledgeNodeContext,
          });
        }
      } else {
        dbLog.warn('handleAssessment: 评分结果解析失败');
      }
    } catch (err) {
      dbLog.error('handleAssessment: 考核评分失败', err);
      setErrorText(err instanceof Error ? err.message : '考核评分失败，请重试');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [currentMessages, knowledgeNodeContext, dispatch, knowledgeService]);

  // 判断是否需要考核评分：知识库模式下，用户最近问了"考考我"之类的话
  const shouldTriggerAssessment = useMemo(() => {
    if (!isKnowledgeMode || currentMessages.length < 3) return false;
    const lastAssistantMsg = [...currentMessages].reverse().find((m) => m.role === 'assistant');
    const lastUserMsg = [...currentMessages].reverse().find((m) => m.role === 'user');
    if (!lastAssistantMsg || !lastUserMsg) return false;
    // 如果用户消息包含"考考我"关键词，说明 AI 已经出题
    // 我们在此等待用户后续的回答消息来触发考核
    const hasAssessmentTrigger = [...currentMessages].some(
      (m) => m.role === 'user' && (m.content.includes('考考我') || m.content.includes('测试一下') || m.content.includes('来几道题')),
    );
    // 检查最近一条用户消息不是触发词本身（即它是回答）
    const lastUserIsAnswer = lastUserMsg.role === 'user'
      && !lastUserMsg.content.includes('考考我')
      && !lastUserMsg.content.includes('测试一下')
      && !lastUserMsg.content.includes('来几道题');
    return hasAssessmentTrigger && lastUserIsAnswer && assessmentResult === null;
  }, [isKnowledgeMode, currentMessages, assessmentResult]);

  // 自动触发考核评分
  useEffect(() => {
    if (shouldTriggerAssessment && !isLoading) {
      handleAssessment();
    }
  }, [shouldTriggerAssessment, isLoading, handleAssessment]);

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

        {/* 知识库模式专属：考核按钮 */}
        {isKnowledgeMode && hasMessages && (
          <TouchableOpacity
            className="flex-row items-center gap-1 rounded-sk-sm px-sk-3 py-1.5 border border-sk-border-soft"
            onPress={handleAssessment}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <Text className="text-sk-xs">📝</Text>
            <Text className="text-sk-xs font-semibold text-sk-text-secondary">评分</Text>
          </TouchableOpacity>
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
