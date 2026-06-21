/**
 * MasteryBadge — 掌握状态徽章组件。
 *
 * ✅ passed    — 绿色
 * 📖 learning  — 蓝色
 * ⬜ not_started — 灰色
 */
import { View, Text } from 'react-native';
import type { MasteryStatus } from '@/types/knowledge';

interface MasteryBadgeProps {
  status: MasteryStatus;
  /** 是否仅显示图标（不显示文字） */
  iconOnly?: boolean;
}

const BADGE_CONFIG: Record<MasteryStatus, { icon: string; color: string; bg: string; label: string }> = {
  passed:     { icon: '✅', color: '#90c208', bg: 'bg-sk-function-success/10',   label: '已通过' },
  mastered:   { icon: '🏆', color: '#90c208', bg: 'bg-sk-function-success/10',   label: '已掌握' },
  learning:   { icon: '📖', color: '#2bf',     bg: 'bg-sk-function-info/10',      label: '学习中' },
  not_started:{ icon: '⬜', color: 'rgba(34,34,34,0.25)', bg: 'bg-sk-border-soft', label: '未开始' },
};

export default function MasteryBadge({ status, iconOnly = false }: MasteryBadgeProps) {
  const config = BADGE_CONFIG[status] ?? BADGE_CONFIG.not_started;

  if (iconOnly) {
    return (
      <View className="items-center justify-center w-6 h-6">
        <Text className="text-base">{config.icon}</Text>
      </View>
    );
  }

  return (
    <View
      className={`flex-row items-center rounded-sk-pill px-2 py-0.5 ${config.bg}`}
    >
      <Text className="text-sk-xs mr-1">{config.icon}</Text>
      <Text className="text-sk-xs font-semibold" style={{ color: config.color }}>
        {config.label}
      </Text>
    </View>
  );
}
