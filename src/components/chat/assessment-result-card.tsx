/**
 * AssessmentResultCard — 考核结果卡片。
 *
 * 渲染：百分比进度条 + 通过/未通过状态 + 解析文本 + 薄弱点列表 + suggestedUserNote。
 */
import { View, Text } from 'react-native';
import type { AssessmentResult } from '@/types/knowledge';

interface AssessmentResultCardProps {
  result: AssessmentResult;
}

export default function AssessmentResultCard({ result }: AssessmentResultCardProps) {
  const { score, analysis, weakPoints, passed, suggestedUserNote } = result;

  const barColor = passed ? '#90c208' : '#ff5a47';
  const statusColor = passed ? 'text-sk-function-success' : 'text-sk-function-error';
  const statusBg = passed ? 'bg-sk-function-success/10' : 'bg-sk-function-error/10';
  const statusLabel = passed ? '✅ 通过考核' : '❌ 未通过';

  return (
    <View className="bg-sk-surface-card rounded-sk-md border border-sk-border-soft overflow-hidden my-2">
      {/* 头部：分数 + 通过/未通过 */}
      <View className="px-sk-4 py-sk-3 border-b border-sk-border-soft">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-sk-text-primary text-sk-md font-semibold">考核结果</Text>
          <View className={`rounded-sk-pill px-3 py-0.5 ${statusBg}`}>
            <Text className={`text-sk-xs font-semibold ${statusColor}`}>{statusLabel}</Text>
          </View>
        </View>

        {/* 百分比进度条 */}
        <View className="flex-row items-center">
          <View className="flex-1 h-3 bg-sk-surface-page rounded-sk-pill overflow-hidden mr-3">
            <View
              className="h-full rounded-sk-pill"
              style={{ width: `${Math.max(score, 2)}%`, backgroundColor: barColor }}
            />
          </View>
          <Text className="text-sk-text-primary text-sk-lg font-bold" style={{ color: barColor }}>
            {score}%
          </Text>
        </View>
      </View>

      {/* 解析文本 */}
      <View className="px-sk-4 py-sk-3 border-b border-sk-border-soft">
        <Text className="text-sk-text-tertiary text-sk-xs font-semibold mb-1">📝 评分解析</Text>
        <Text className="text-sk-text-secondary text-sk-sm leading-5">{analysis}</Text>
      </View>

      {/* 薄弱点列表 */}
      {weakPoints.length > 0 && (
        <View className="px-sk-4 py-sk-3 border-b border-sk-border-soft">
          <Text className="text-sk-text-tertiary text-sk-xs font-semibold mb-2">⚠️ 薄弱点</Text>
          {weakPoints.map((point, index) => (
            <View key={index} className="flex-row items-start mb-1">
              <Text className="text-sk-function-error text-sk-xs mr-2 mt-0.5">•</Text>
              <Text className="text-sk-text-secondary text-sk-sm flex-1">{point}</Text>
            </View>
          ))}
        </View>
      )}

      {/* 建议笔记 */}
      {suggestedUserNote ? (
        <View className="px-sk-4 py-sk-3 bg-brand/5">
          <Text className="text-sk-text-tertiary text-sk-xs font-semibold mb-1">💡 建议笔记</Text>
          <Text className="text-sk-text-primary text-sk-sm leading-5">{suggestedUserNote}</Text>
        </View>
      ) : null}
    </View>
  );
}
