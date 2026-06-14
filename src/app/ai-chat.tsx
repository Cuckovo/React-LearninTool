import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useRef, useCallback } from 'react';
import { useAppState, generateId, type ChatMessage, type ParsedAIResponse } from '@/lib/app-state';
import { parseAIResponse } from '@/lib/ai-parser';
import { sendChatMessage } from '@/lib/api';

function ChatBubble({
  message,
  onViewPlot,
}: {
  message: ChatMessage;
  onViewPlot: (expr: string) => void;
}) {
  const isUser = message.role === 'user';
  const parsed: ParsedAIResponse | undefined = message.parsed;
  const hasSolution = parsed?.parsed && parsed.solution;
  const hasPlot = parsed?.parsed && parsed.isPlottable && parsed.functionExpression;

  return (
    <View className={`mb-4 ${isUser ? 'items-end' : 'items-start'}`}>
      {/* 角色标签 */}
      <Text className="text-sk-text-disabled text-sk-xs mb-1">
        {isUser ? '你' : 'AI 助手'}
      </Text>

      {/* AI 解析后的结构化输出 */}
      {!isUser && hasSolution ? (
        <View className="bg-sk-surface-card rounded-sk-md px-sk-4 py-sk-3 max-w-[85%] border border-sk-border-soft">
          {/* 【解题过程】 */}
          <Text className="text-sk-text-primary text-sk-sm mb-2 font-semibold">
            【解题过程】
          </Text>
          <Text className="text-sk-text-secondary text-sk-sm leading-6 mb-3">
            {parsed.solution}
          </Text>

          {/* 【图像判断】 */}
          <Text className="text-sk-text-primary text-sk-sm mb-1 font-semibold">
            【图像判断】
          </Text>
          <Text className="text-sk-text-secondary text-sk-sm mb-3">
            {parsed.isPlottable ? '可绘制' : '不可绘制'}
          </Text>

          {/* 【函数表达式】 */}
          <Text className="text-sk-text-primary text-sk-sm mb-1 font-semibold">
            【函数表达式】
          </Text>
          <Text className="text-sk-text-secondary text-sk-sm mb-3 font-mono">
            {parsed.functionExpression ?? '无'}
          </Text>

          {/* 查看图像按钮 */}
          {hasPlot && (
            <TouchableOpacity
              className="bg-brand rounded-sk-sm px-sk-4 py-2 self-start"
              onPress={() => onViewPlot(parsed.functionExpression!)}
              activeOpacity={0.7}
            >
              <Text className="text-white text-sk-sm font-semibold">查看图像</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        /* 普通文本气泡 */
        <View
          className={`rounded-sk-md px-sk-4 py-sk-3 max-w-[85%] ${
            isUser
              ? 'bg-brand text-white'
              : 'bg-sk-surface-card border border-sk-border-soft'
          }`}
        >
          <Text
            className={`text-sk-sm ${
              isUser ? 'text-white' : 'text-sk-text-primary'
            }`}
          >
            {message.content}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function AIChatScreen() {
  const { state, dispatch } = useAppState();
  const { messages, isLoading } = state;
  const [input, setInput] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const handleViewPlot = useCallback(
    (expression: string) => {
      dispatch({
        type: 'SEND_PLOT_COMMAND',
        payload: { expression, timestamp: Date.now() },
      });
      dispatch({ type: 'SET_ACTIVE_TAB', payload: 'geogebra' });
    },
    [dispatch]
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    setErrorText(null);

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    dispatch({ type: 'ADD_MESSAGE', payload: userMsg });
    dispatch({ type: 'SET_LOADING', payload: true });
    scrollToBottom();

    try {
      const allMessages = [...messages, userMsg];
      const reply = await sendChatMessage(allMessages);
      const parsed = parseAIResponse(reply);

      const aiMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: reply,
        parsed,
        timestamp: Date.now(),
      };

      dispatch({ type: 'ADD_MESSAGE', payload: aiMsg });
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : '未知错误，请重试';
      setErrorText(errorMsg);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      scrollToBottom();
    }
  }, [input, isLoading, messages, dispatch, scrollToBottom]);

  // 欢迎消息数据
  const hasMessages = messages.length > 0;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-sk-surface-page"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* 标题栏 */}
      <View className="bg-sk-surface-card px-sk-4 py-sk-3 border-b border-sk-border-soft">
        <Text className="text-sk-text-primary text-sk-lg font-display font-semibold">
          AI 数学助手
        </Text>
      </View>

      {/* 对话列表 */}
      {hasMessages ? (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatBubble message={item} onViewPlot={handleViewPlot} />
          )}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            paddingBottom: 16,
          }}
          onContentSizeChange={() => scrollToBottom()}
          onLayout={() => scrollToBottom()}
        />
      ) : (
        <View className="flex-1 justify-center items-center px-sk-8">
          <Text className="text-sk-text-tertiary text-sk-lg mb-2">
            欢迎使用 AI 数学助手
          </Text>
          <Text className="text-sk-text-disabled text-sk-sm text-center leading-5">
            {Platform.OS === 'web'
              ? `输入高等数学问题，我将为你分步解题并提供函数图像。\n\n提示：fmtNumber → 格式化数字；等待... → 模拟思考过程；探索随机化种子 42。`
              : '输入高等数学问题，我将为你分步解题并提供函数图像。'}
          </Text>
        </View>
      )}

      {/* 加载指示器 */}
      {isLoading && (
        <View className="flex-row items-center justify-center py-2 bg-sk-surface-page">
          <ActivityIndicator size="small" color="#90c208" />
          <Text className="text-sk-text-tertiary text-sk-sm ml-2">等待...</Text>
        </View>
      )}

      {/* 错误提示 */}
      {errorText && (
        <View className="px-sk-4 py-2 bg-sk-function-error/10">
          <Text className="text-sk-function-error text-sk-xs">{errorText}</Text>
        </View>
      )}

      {/* 输入区域 */}
      <View className="bg-sk-surface-card border-t border-sk-border-soft px-sk-4 py-sk-3 flex-row items-end">
        <TextInput
          className="flex-1 bg-sk-surface-page rounded-sk-sm px-sk-3 py-2 text-sk-text-primary text-sk-sm max-h-24"
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
          className={`ml-3 rounded-sk-sm px-sk-4 py-2 ${
            isLoading || !input.trim() ? 'bg-sk-border-default' : 'bg-brand'
          }`}
          onPress={handleSend}
          disabled={isLoading || !input.trim()}
          activeOpacity={0.7}
        >
          <Text className="text-white text-sk-sm font-semibold">发送</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
