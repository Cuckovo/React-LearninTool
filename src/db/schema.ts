import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/** 会话表 — 一条会话记录包含多条消息 */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
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
