/**
 * KnowledgeTree — 递归 SectionList 知识树组件。
 *
 * 展示可展开/折叠的四层树结构（subject > chapter > section > concept）。
 * 叶子节点（concept）右侧显示 MasteryBadge，点击后回调 selectNode。
 *
 * 使用 FlatList 嵌套实现递归展开。
 */
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { useState } from 'react';
import MasteryBadge from './mastery-badge';
import type { TreeNode } from '@/types/knowledge';

interface KnowledgeTreeProps {
  tree: TreeNode[];
  onSelectNode: (nodeId: string, label: string, definition: string | null) => void;
  /** 当前选中的节点 ID，高亮显示 */
  selectedNodeId: string | null;
}

/** ── 单个树节点行 ── */
function TreeNodeRow({
  item,
  depth,
  onSelectNode,
  selectedNodeId,
  expandedIds,
  onToggle,
}: {
  item: TreeNode;
  depth: number;
  onSelectNode: (nodeId: string, label: string, definition: string | null) => void;
  selectedNodeId: string | null;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const node = item.node;
  const isLeaf = node.type === 'concept';
  const hasChildren = item.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const paddingLeft = 12 + depth * 20;

  const toggleExpand = () => {
    if (hasChildren) {
      onToggle(node.id);
    }
  };

  const handlePress = () => {
    if (isLeaf) {
      onSelectNode(node.id, node.label, node.standardDefinition);
    } else {
      toggleExpand();
    }
  };

  // 根据节点类型选择图标
  const typeIcon: Record<string, string> = {
    subject: '📘',
    chapter: '📂',
    section: '📄',
    concept: '📝',
  };

  return (
    <>
      <TouchableOpacity
        className={`flex-row items-center py-sk-2 border-b border-sk-border-soft ${isSelected ? 'bg-brand/10' : ''}`}
        style={{ paddingLeft }}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {/* 展开/折叠箭头 */}
        <View className="w-5 items-center justify-center mr-1">
          {hasChildren ? (
            <Text className="text-sk-text-tertiary text-sk-xs">
              {isExpanded ? '▼' : '▶'}
            </Text>
          ) : (
            <Text className="text-sk-text-disabled text-sk-xs">·</Text>
          )}
        </View>

        {/* 类型图标 */}
        <Text className="text-sk-sm mr-2">{typeIcon[node.type] ?? '📝'}</Text>

        {/* 标签 */}
        <View className="flex-1 mr-2">
          <Text
            className={`text-sk-sm ${isLeaf ? 'font-semibold' : ''} ${isSelected ? 'text-brand' : 'text-sk-text-primary'}`}
            numberOfLines={1}
          >
            {node.label}
          </Text>
        </View>

        {/* 叶子节点：掌握状态徽章 */}
        {isLeaf && (
          <MasteryBadge status={node.masteryStatus} iconOnly />
        )}
      </TouchableOpacity>

      {/* 递归渲染子节点 */}
      {isExpanded && hasChildren && (
        <View>
          {item.children.map((child) => (
            <TreeNodeRow
              key={child.node.id}
              item={child}
              depth={depth + 1}
              onSelectNode={onSelectNode}
              selectedNodeId={selectedNodeId}
              expandedIds={expandedIds}
              onToggle={onToggle}
            />
          ))}
        </View>
      )}
    </>
  );
}

/** ── 主组件 ── */
export default function KnowledgeTree({
  tree,
  onSelectNode,
  selectedNodeId,
}: KnowledgeTreeProps) {
  // 默认展开第一层
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    for (const root of tree) {
      ids.add(root.node.id);
      for (const child of root.children) {
        ids.add(child.node.id);
      }
    }
    return ids;
  });

  const handleToggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 将树展平为渲染列表（仅顶层 + 递归行）
  const flattenedData = tree;

  return (
    <View className="bg-sk-surface-card rounded-sk-md border border-sk-border-soft overflow-hidden">
      <View className="px-sk-4 py-sk-2 bg-sk-surface-page border-b border-sk-border-soft">
        <Text className="text-sk-text-secondary text-sk-xs font-semibold">知识树</Text>
      </View>
      {flattenedData.length === 0 ? (
        <View className="py-sk-8 items-center">
          <Text className="text-sk-text-disabled text-sk-sm">暂无知识节点</Text>
        </View>
      ) : (
        <View>
          {flattenedData.map((root) => (
            <TreeNodeRow
              key={root.node.id}
              item={root}
              depth={0}
              onSelectNode={onSelectNode}
              selectedNodeId={selectedNodeId}
              expandedIds={expandedIds}
              onToggle={handleToggle}
            />
          ))}
        </View>
      )}
    </View>
  );
}
