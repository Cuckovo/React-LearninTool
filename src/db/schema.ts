import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/** 会话表 — 一条会话记录包含多条消息 */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    /** 会话类型：solver（解题模式）或 knowledge（知识库学习模式） */
    type: text('type', { enum: ['solver', 'knowledge'] }).default('solver').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_sessions_updated_at').on(table.updatedAt),
  ],
);

/** 消息表 — 每条消息属于一个会话，会话删除时级联删除 */
export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant'] }).notNull(),
    content: text('content').notNull(),
    /** parsed.solution — 分步解题过程 */
    solution: text('solution'),
    /** parsed.isPlottable — 0/1 */
    isPlottable: integer('is_plottable'),
    /** parsed.functionExpression */
    functionExpression: text('function_expression'),
    /** parsed.raw — 原始 AI 回复 */
    raw: text('raw'),
    /** parsed.parsed — 解析是否成功 */
    parsed: integer('parsed').notNull().default(0),
    /** parsed.parseError */
    parseError: text('parse_error'),
    /** 消息时间戳（毫秒） */
    timestamp: integer('timestamp').notNull(),
  },
  (table) => [
    index('idx_messages_session_id').on(table.sessionId),
    index('idx_messages_timestamp').on(table.timestamp),
  ],
);

/** 知识节点表 — 四层树结构：subject > chapter > section > concept */
export const knowledgeNodes = sqliteTable(
  'knowledge_nodes',
  {
    id: text('id').primaryKey(),
    parentId: text('parent_id'),
    type: text('type', { enum: ['subject', 'chapter', 'section', 'concept'] }).notNull(),
    label: text('label').notNull(),
    standardDefinition: text('standard_definition'),
    userNotes: text('user_notes'),
    masteryStatus: text('mastery_status', {
      enum: ['not_started', 'learning', 'passed', 'mastered'],
    })
      .notNull()
      .default('not_started'),
    metadata: text('metadata'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_nodes_parent').on(table.parentId),
    index('idx_nodes_type').on(table.type),
    index('idx_nodes_label').on(table.label),
  ],
);

/** Agent 操作日志表 — Demo 阶段写入但不展示 UI */
export const agentLogs = sqliteTable(
  'agent_logs',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id').notNull(),
    action: text('action').notNull(),
    target: text('target'),
    payload: text('payload'),
    timestamp: integer('timestamp').notNull(),
  },
  (table) => [
    index('idx_logs_session').on(table.sessionId),
  ],
);
