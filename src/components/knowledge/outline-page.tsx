/**
 * OutlinePage — 知识库大纲页。
 *
 * 顶部：学科选择器（当前写死"高等数学"）
 * 进度概览条（ProgressOverview 组件）
 * 知识树（KnowledgeTree 组件）
 */
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import KnowledgeTree from './knowledge-tree';
import ProgressOverview from './progress-overview';
import { KnowledgeService } from '@/db/knowledge-service';
import type { TreeNode, ProgressStats } from '@/types/knowledge';

interface OutlinePageProps {
  onSelectNode: (nodeId: string, label: string, definition: string | null) => void;
  selectedNodeId: string | null;
}

export default function OutlinePage({ onSelectNode, selectedNodeId }: OutlinePageProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [stats, setStats] = useState<ProgressStats>({
    totalLeafNodes: 0, passed: 0, learning: 0, notStarted: 0, percentage: 0,
  });
  const [loading, setLoading] = useState(true);

  const service = new KnowledgeService();

  const loadData = useCallback(async () => {
    try {
      // 使用异步 getExpoDb() 确保 Web 端 Worker 已就绪
      const { getExpoDb } = await import('@/db/database');
      await getExpoDb();

      // 确保种子数据已初始化（幂等）
      await service.initializeDemoData();

      const [fullTree, progress] = await Promise.all([
        service.getFullTree(),
        service.getProgress(),
      ]);
      setTree(fullTree);
      setStats(progress);
    } catch {
      // 静默处理，使用默认空数据
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-sk-surface-page">
        <ActivityIndicator size="small" color="#90c208" />
        <Text className="text-sk-text-tertiary text-sk-sm mt-2">加载知识树...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-sk-surface-page"
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
      showsVerticalScrollIndicator={false}
    >
      {/* 学科选择器 */}
      <View className="mb-sk-3">
        <View className="flex-row items-center bg-sk-surface-card rounded-sk-md px-sk-4 py-sk-3 border border-sk-border-soft">
          <Text className="text-sk-lg mr-2">📘</Text>
          <View>
            <Text className="text-sk-text-primary text-sk-md font-semibold">高等数学</Text>
            <Text className="text-sk-text-tertiary text-sk-xs">同济版 · 第七版</Text>
          </View>
        </View>
      </View>

      {/* 进度概览条 */}
      <View className="mb-sk-3">
        <ProgressOverview stats={stats} />
      </View>

      {/* 知识树 */}
      <KnowledgeTree
        tree={tree}
        onSelectNode={onSelectNode}
        selectedNodeId={selectedNodeId}
      />

      {/* 底部空白 */}
      <View className="h-sk-8" />
    </ScrollView>
  );
}
