import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, KeyboardAvoidingView, Platform, Animated,
  Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppState, generateId, type ChatMessage, type ChatSession, type ParsedAIResponse } from '@/lib/app-state';
import { parseAIResponse } from '@/lib/ai-parser';
import { sendChatMessage } from '@/lib/api';
import { GeoGebraDrawIcon, MathLanguageIcon, PushMessageIcon, HistoryIcon, NewChatIcon } from '@/constants/icons';

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
function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const parsed: ParsedAIResponse | undefined = message.parsed;
  const hasSolution = parsed?.parsed && parsed.solution;

  return (
    <View className={`mb-4 ${isUser ? 'items-end' : 'items-start'}`}>
      <Text className="text-sk-text-disabled text-sk-xs mb-1">{isUser ? '你' : 'AI 助手'}</Text>
      {!isUser && hasSolution ? (
        <View className="bg-sk-surface-card rounded-sk-md px-sk-4 py-sk-3 max-w-[85%] border border-sk-border-soft">
          <Text className="text-sk-text-primary text-sk-sm mb-2 font-semibold">【解题过程】</Text>
          <Text className="text-sk-text-secondary text-sk-sm leading-6 mb-3">{parsed.solution}</Text>
          <Text className="text-sk-text-primary text-sk-sm mb-1 font-semibold">【图像判断】</Text>
          <Text className="text-sk-text-secondary text-sk-sm mb-3">{parsed.isPlottable ? '可绘制' : '不可绘制'}</Text>
          <Text className="text-sk-text-primary text-sk-sm mb-1 font-semibold">【函数表达式】</Text>
          <Text className="text-sk-text-secondary text-sk-sm mb-3 font-mono">{parsed.functionExpression ?? '无'}</Text>
        </View>
      ) : (
        <View className={`rounded-sk-md px-sk-4 py-sk-3 max-w-[85%] ${isUser ? 'bg-brand' : 'bg-sk-surface-card border border-sk-border-soft'}`}>
          <Text className={`text-sk-sm ${isUser ? 'text-white' : 'text-sk-text-primary'}`}>{message.content}</Text>
        </View>
      )}
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
              return (
                <TouchableOpacity
                  key={s.id}
                  className={`px-sk-4 py-sk-3 border-b border-sk-border-soft flex-row items-center ${isActive ? 'bg-brand/10' : ''}`}
                  onPress={() => { onSwitch(s.id); onClose(); }}
                  activeOpacity={0.7}
                  onLongPress={() => onDelete(s.id)}
                >
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
  const { sessions, activeSessionId, isLoading } = state;
  const [input, setInput] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();

  const { isPlottable, functionExpression, hasSolution } = useLatestParsed(currentMessages);
  const hasMessages = currentMessages.length > 0;
  const canSend = !!input.trim() && !isLoading;

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
  }, [dispatch]);

  const handleSwitchSession = useCallback((id: string) => {
    dispatch({ type: 'SWITCH_SESSION', payload: id });
  }, [dispatch]);

  const handleDeleteSession = useCallback((id: string) => {
    dispatch({ type: 'DELETE_SESSION', payload: id });
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
      const reply = await sendChatMessage(currentForApi);
      const parsed = parseAIResponse(reply);
      const aiMsg: ChatMessage = { id: generateId(), role: 'assistant', content: reply, parsed, timestamp: Date.now() };
      dispatch({ type: 'ADD_MESSAGE', payload: aiMsg });
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : '未知错误，请重试');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      scrollToBottom();
    }
  }, [input, isLoading, currentMessages, dispatch, scrollToBottom]);

  return (
    <SafeAreaView className="flex-1 bg-sk-surface-page">
      <KeyboardAvoidingView
        className="flex-1 bg-sk-surface-page"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      {/* 标题栏：左侧历史按钮 + 右侧新建会话 */}
      <View className="bg-sk-surface-card px-sk-4 py-sk-3 border-b border-sk-border-soft flex-row justify-between items-center">
        <TouchableOpacity
          className="flex-row items-center gap-2"
          onPress={() => setHistoryVisible(true)}
          activeOpacity={0.7}
        >
          <HistoryIcon size={20} color="rgba(34,34,34,0.7)" />
          <Text className="text-sk-text-secondary text-sk-sm">历史对话</Text>
        </TouchableOpacity>

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
          renderItem={({ item }) => <ChatBubble message={item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 8 }}
          onContentSizeChange={() => scrollToBottom()}
          onLayout={() => scrollToBottom()}
        />
      ) : (
        <View className="flex-1 justify-center items-center px-sk-8">
          <Text className="text-sk-text-tertiary text-sk-lg mb-2">欢迎使用 AI 数学助手</Text>
          <Text className="text-sk-text-disabled text-sk-sm text-center leading-5">
            输入高等数学问题，我将为你分步解题并提供函数图像。
          </Text>
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

      {/* 操作按钮列表 — 输入框上方，镂空 + icon */}
      <View className="flex-row justify-end gap-2 px-sk-4 py-2 bg-sk-surface-page border-t border-sk-border-soft">
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
      </View>

      {/* 输入区域 */}
      <View className="bg-sk-surface-card border-t border-sk-border-soft px-sk-4 py-sk-3">
        <View className="flex-row items-center">
          <TextInput
            className="flex-1 bg-sk-surface-page rounded-sk-sm px-sk-3 py-2.5 text-sk-text-primary text-sk-sm"
            placeholder="输入数学问题..."
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
