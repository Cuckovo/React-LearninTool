/**
 * DetailPage — 知识节点详情页。
 *
 * Top栏：左侧「←大纲」圆角按钮 + 中部节点标题 + MasteryBadge
 * 标准定义区域：只读 Text，灰色背景卡片
 * 我的笔记区域：可编辑（单击 → TextInput → 1秒防抖自动保存 → 键盘收起恢复阅览）
 * 底部固定「去学习这个知识点」按钮
 */
import {
  View, Text, TextInput, TouchableOpacity,
  Keyboard, ScrollView, Platform,
} from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'expo-router';
import MasteryBadge from './mastery-badge';
import { KnowledgeService } from '@/db/knowledge-service';
import type { KnowledgeNode, MasteryStatus } from '@/types/knowledge';
import { useAppState } from '@/lib/app-state';

interface DetailPageProps {
  nodeId: string;
  nodeLabel: string;
  nodeDefinition: string | null;
  onBack: () => void;
  isWideScreen: boolean;
}

export default function DetailPage({
  nodeId,
  nodeLabel,
  nodeDefinition,
  onBack,
  isWideScreen,
}: DetailPageProps) {
  const router = useRouter();
  const { dispatch } = useAppState();
  const service = new KnowledgeService();

  const [node, setNode] = useState<KnowledgeNode | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [localNotes, setLocalNotes] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  // 加载节点完整数据
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await service.getNode(nodeId);
      if (!cancelled && loaded) {
        setNode(loaded);
        setLocalNotes(loaded.userNotes ?? '');
      }
    })();
    return () => { cancelled = true; };
  }, [nodeId]);

  // 键盘收起 → 恢复阅览模式
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardDidHide' : 'keyboardDidHide',
      () => {
        setIsEditing(false);
      },
    );
    return () => showSub.remove();
  }, []);

  // 笔记变更防抖保存
  const handleNotesChange = useCallback((text: string) => {
    setLocalNotes(text);
    setSaveStatus(null);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        await service.setUserNotes(nodeId, text);
        setSaveStatus('已自动保存 ✓');
        setNode((prev) => prev ? { ...prev, userNotes: text } : prev);
      } catch {
        setSaveStatus('保存失败，请重试');
      }
    }, 1000);
  }, [nodeId]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // 点击笔记区域进入编辑
  const handleNotesPress = () => {
    if (!isEditing) {
      setIsEditing(true);
      // 延迟 focus 确保 TextInput 已渲染
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // 去学习
  const handleGoLearn = () => {
    dispatch({
      type: 'CREATE_KNOWLEDGE_SESSION',
      payload: {
        nodeId,
        nodeLabel,
        standardDefinition: nodeDefinition ?? null,
        timestamp: Date.now(),
      },
    });
    router.navigate('/ai-chat');
  };

  const masteryStatus: MasteryStatus = node?.masteryStatus ?? 'not_started';

  return (
    <View className="flex-1 bg-sk-surface-page">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top栏：←大纲 + 标题 + MasteryBadge */}
        <View className="flex-row items-center mb-sk-4">
          {/* 手机端：返回大纲按钮 */}
          {!isWideScreen && (
            <TouchableOpacity
              className="flex-row items-center bg-sk-surface-card rounded-sk-pill px-sk-3 py-1.5 border border-sk-border-soft mr-3"
              onPress={onBack}
              activeOpacity={0.7}
            >
              <Text className="text-sk-text-secondary text-sk-sm">← 大纲</Text>
            </TouchableOpacity>
          )}

          {/* 标题 + 徽章 */}
          <View className="flex-1 flex-row items-center">
            <Text className="text-sk-text-primary text-sk-md font-semibold flex-1 mr-2" numberOfLines={2}>
              {nodeLabel}
            </Text>
            <MasteryBadge status={masteryStatus} />
          </View>
        </View>

        {/* 标准定义区域 — 只读 */}
        {nodeDefinition ? (
          <View className="bg-sk-surface-page rounded-sk-md px-sk-4 py-sk-3 mb-sk-4 border border-sk-border-soft">
            <Text className="text-sk-text-tertiary text-sk-xs font-semibold mb-2">📖 标准定义</Text>
            <Text className="text-sk-text-secondary text-sk-sm leading-6" selectable>
              {nodeDefinition}
            </Text>
          </View>
        ) : (
          <View className="bg-sk-surface-page rounded-sk-md px-sk-4 py-sk-3 mb-sk-4 border border-sk-border-soft">
            <Text className="text-sk-text-disabled text-sk-sm">暂无标准定义</Text>
          </View>
        )}

        {/* 我的笔记区域 — 可编辑 */}
        <View className="bg-sk-surface-card rounded-sk-md border border-sk-border-soft overflow-hidden mb-sk-4">
          <View className="flex-row justify-between items-center px-sk-4 py-sk-2 bg-sk-surface-page border-b border-sk-border-soft">
            <Text className="text-sk-text-tertiary text-sk-xs font-semibold">✏️ 我的笔记</Text>
            {saveStatus && (
              <Text className={`text-sk-xs ${saveStatus.includes('失败') ? 'text-sk-function-error' : 'text-sk-function-success'}`}>
                {saveStatus}
              </Text>
            )}
          </View>

          {isEditing ? (
            <TextInput
              ref={inputRef}
              className="px-sk-4 py-sk-3 text-sk-text-primary text-sk-sm min-h-[100px]"
              value={localNotes}
              onChangeText={handleNotesChange}
              placeholder="输入你的笔记..."
              placeholderTextColor="rgba(34,34,34,0.25)"
              multiline
              textAlignVertical="top"
              onBlur={() => setIsEditing(false)}
              autoFocus
            />
          ) : (
            <TouchableOpacity
              className="px-sk-4 py-sk-3 min-h-[80px]"
              onPress={handleNotesPress}
              activeOpacity={0.7}
            >
              {localNotes ? (
                <Text className="text-sk-text-primary text-sk-sm leading-6" selectable>
                  {localNotes}
                </Text>
              ) : (
                <Text className="text-sk-text-disabled text-sk-sm">
                  点击添加笔记...
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* 底部固定「去学习这个知识点」按钮 */}
      <View className="absolute bottom-0 left-0 right-0 bg-sk-surface-page px-sk-4 py-sk-3 border-t border-sk-border-soft">
        <TouchableOpacity
          className="bg-brand rounded-sk-md py-3 items-center justify-center"
          onPress={handleGoLearn}
          activeOpacity={0.8}
        >
          <Text className="text-white text-sk-sm font-semibold">🚀 去学习这个知识点</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
