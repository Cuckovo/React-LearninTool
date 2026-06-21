// ── 知识库类型定义 (方案 v1.4) ──

/** 知识节点层级类型 */
export type NodeType = 'subject' | 'chapter' | 'section' | 'concept';

/** 掌握状态 */
export type MasteryStatus = 'not_started' | 'learning' | 'passed' | 'mastered';

/** 知识节点实体 */
export interface KnowledgeNode {
  id: string;
  parentId: string | null;
  type: NodeType;
  label: string;
  standardDefinition: string | null;
  userNotes: string | null;
  masteryStatus: MasteryStatus;
  metadata: Record<string, unknown> | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

/** 递归树节点 */
export interface TreeNode {
  node: KnowledgeNode;
  children: TreeNode[];
}

/** 进度统计 */
export interface ProgressStats {
  totalLeafNodes: number;
  passed: number;
  learning: number;
  notStarted: number;
  percentage: number; // 0-100
}

/** AI 回复中的 DB 指令 */
export interface DBCommand {
  action: 'set_user_notes' | 'set_mastery' | 'get_node' | 'get_children';
  nodeId: string;
  value?: string;
  parentId?: string;
}

/** 考核评分结果 */
export interface AssessmentResult {
  score: number;
  analysis: string;
  weakPoints: string[];
  passed: boolean;
  suggestedUserNote: string;
}

/** 种子数据：章 */
export interface ChapterSeed {
  label: string;
  sortOrder: number;
  sections: SectionSeed[];
}

/** 种子数据：节 */
export interface SectionSeed {
  label: string;
  sortOrder: number;
  concepts: ConceptSeed[];
}

/** 种子数据：概念叶子 */
export interface ConceptSeed {
  label: string;
  sortOrder: number;
  standardDefinition: string;
}

/** 会话类型 */
export type SessionType = 'solver' | 'knowledge';

/** 对话模式 */
export type ChatMode = 'solver' | 'knowledge';
