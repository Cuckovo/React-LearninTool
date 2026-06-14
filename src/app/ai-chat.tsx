import { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppState, generateId, type ChatMessage, type ParsedAIResponse } from '@/lib/app-state';
import { parseAIResponse } from '@/lib/ai-parser';
import { sendChatMessage } from '@/lib/api';
import { GeoGebraDrawIcon, MathLanguageIcon, PushMessageIcon, HistoryIcon, XIcon, NewChatIcon } from '@/constants/icons';

const MAX_HISTORY = 10;

/* ── 根据最新 AI 回复提取状态 ── */
function useLatestParsed() {
  const { state } = useAppState();
  return useMemo(() => {
    const lastAssistant = [...state.messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistant?.parsed?.parsed) return { isPlottable: false, functionExpression: null as string | null, hasSolution: false };
    return {
      isPlottable: lastAssistant.parsed.isPlottable,
      functionExpression: lastAssistant.parsed.functionExpression,
      hasSolution: !!(lastAssistant.parsed.solution),
    };
  }, [state.messages]);
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

/* ── 历史对话 Modal ── */
function HistoryModal({
  visible,
  messages,
  onClose,
  onSelect,
}: {
  visible: boolean;
  messages: ChatMessage[];
  onClose: () => void;
  onSelect: (index: number) => void;
}) {
  // 只显示最近 MAX_HISTORY 条，按时间倒序
  const history = useMemo(() => {
    return [...messages]
      .filter((m) => m.role === 'user')
      .reverse()
      .slice(0, MAX_HISTORY);
  }, [messages]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity className="flex-1 bg-black/40 justify-end" activeOpacity={1} onPress={onClose}>
        <View className="bg-sk-surface-card rounded-t-sk-lg max-h-[60%]">
          <View className="flex-row justify-between items-center px-sk-4 py-sk-3 border-b border-sk-border-soft">
            <Text className="text-sk-text-primary text-sk-md font-semibold">历史对话</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <XIcon size={20} color="rgba(34,34,34,0.5)" />
            </TouchableOpacity>
          </View>
          {history.length === 0 ? (
            <View className="py-sk-8 items-center">
              <Text className="text-sk-text-disabled text-sk-sm">暂无对话记录</Text>
            </View>
          ) : (
            <FlatList
              data={history}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  className="px-sk-4 py-sk-3 border-b border-sk-border-soft"
                  onPress={() => { onClose(); onSelect(messages.indexOf(item)); }}
                  activeOpacity={0.7}
                >
                  <Text className="text-sk-text-primary text-sk-sm" numberOfLines={1}>{item.content}</Text>
                  <Text className="text-sk-text-tertiary text-sk-xs mt-1">{new Date(item.timestamp).toLocaleString('zh-CN')}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

/* ── 主页面 ── */
export default function AIChatScreen() {
  const { state, dispatch } = useAppState();
  const { messages, isLoading } = state;
  const [input, setInput] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();

  const { isPlottable, functionExpression, hasSolution } = useLatestParsed();
  const hasMessages = messages.length > 0;
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
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistant?.parsed?.parsed) return;
    const text = `【解题过程】\n${lastAssistant.parsed.solution}\n\n【函数表达式】\n${lastAssistant.parsed.functionExpression ?? '无'}`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => alert('已复制到剪贴板'));
    }
  }, [messages]);

  const handleNewChat = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY' });
  }, [dispatch]);

  const handleSelectHistory = useCallback((index: number) => {
    // 滚动到选中的对话
    flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    setErrorText(null);

    const userMsg: ChatMessage = { id: generateId(), role: 'user', content: text, timestamp: Date.now() };
    dispatch({ type: 'ADD_MESSAGE', payload: userMsg });
    dispatch({ type: 'SET_LOADING', payload: true });
    scrollToBottom();

    try {
      const reply = await sendChatMessage([...messages, userMsg]);
      const parsed = parseAIResponse(reply);
      const aiMsg: ChatMessage = { id: generateId(), role: 'assistant', content: reply, parsed, timestamp: Date.now() };
      dispatch({ type: 'ADD_MESSAGE', payload: aiMsg });
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : '未知错误，请重试');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      scrollToBottom();
    }
  }, [input, isLoading, messages, dispatch, scrollToBottom]);

  return (
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

        <TouchableOpacity
          onPress={handleNewChat}
          activeOpacity={0.7}
          className="p-1"
        >
          <NewChatIcon size={20} color="rgba(34,34,34,0.7)" />
        </TouchableOpacity>
      </View>

      {/* 历史对话 Modal */}
      <HistoryModal
        visible={historyVisible}
        messages={messages}
        onClose={() => setHistoryVisible(false)}
        onSelect={handleSelectHistory}
      />

      {/* 对话列表 */}
      {hasMessages ? (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
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
        {/* 绘制图像 */}
        <TouchableOpacity
          className={`flex-row items-center gap-1 rounded-sk-sm px-sk-3 py-1.5 border ${
            isPlottable ? 'border-sk-border-brand' : 'border-sk-border-soft'
          }`}
          onPress={handleViewPlot}
          disabled={!isPlottable}
          activeOpacity={0.7}
        >
          <GeoGebraDrawIcon size={14} color={isPlottable ? '#90c208' : 'rgba(34,34,34,0.25)'} />
          <Text className={`text-sk-xs font-semibold ${isPlottable ? 'text-brand' : 'text-sk-text-disabled'}`}>绘制图像</Text>
        </TouchableOpacity>

        {/* 分享过程 */}
        <TouchableOpacity
          className={`flex-row items-center gap-1 rounded-sk-sm px-sk-3 py-1.5 border ${
            hasSolution ? 'border-sk-border-brand' : 'border-sk-border-soft'
          }`}
          onPress={handleShareProcess}
          disabled={!hasSolution}
          activeOpacity={0.7}
        >
          <MathLanguageIcon size={14} color={hasSolution ? '#90c208' : 'rgba(34,34,34,0.25)'} />
          <Text className={`text-sk-xs font-semibold ${hasSolution ? 'text-brand' : 'text-sk-text-disabled'}`}>分享过程</Text>
        </TouchableOpacity>
      </View>

      {/* 输入区域 — 发送按钮在内部垂直居中，icon only */}
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
  );
}
