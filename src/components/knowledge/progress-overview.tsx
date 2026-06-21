/**
 * ProgressOverview — 进度概览条。
 *
 * 显示进度条 + "2/5 passed (40%)" 文字。
 */
import { View, Text } from 'react-native';
import type { ProgressStats } from '@/types/knowledge';

interface ProgressOverviewProps {
  stats: ProgressStats;
}

export default function ProgressOverview({ stats }: ProgressOverviewProps) {
  const { totalLeafNodes, passed, learning, notStarted, percentage } = stats;
  const effectivePassed = passed;
  const barWidth = totalLeafNodes > 0 ? (effectivePassed / totalLeafNodes) * 100 : 0;

  const statusText = totalLeafNodes > 0
    ? `${effectivePassed}/${totalLeafNodes} passed (${percentage}%)`
    : '暂无数据';

  return (
    <View className="bg-sk-surface-card rounded-sk-md px-sk-4 py-sk-3 border border-sk-border-soft">
      {/* 文字行 */}
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-sk-text-secondary text-sk-xs font-semibold">学习进度</Text>
        <Text className="text-sk-text-primary text-sk-xs font-semibold">{statusText}</Text>
      </View>

      {/* 进度条 */}
      <View className="h-2 bg-sk-surface-page rounded-sk-pill overflow-hidden">
        <View
          className="h-full bg-brand rounded-sk-pill"
          style={{ width: `${Math.max(barWidth, 2)}%` }}
        />
      </View>

      {/* 图例 */}
      {totalLeafNodes > 0 && (
        <View className="flex-row justify-between mt-2">
          <View className="flex-row items-center">
            <Text className="text-sk-xs mr-1">✅</Text>
            <Text className="text-sk-text-tertiary text-sk-xs">{passed}</Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-sk-xs mr-1">📖</Text>
            <Text className="text-sk-text-tertiary text-sk-xs">{learning}</Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-sk-xs mr-1">⬜</Text>
            <Text className="text-sk-text-tertiary text-sk-xs">{notStarted}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
