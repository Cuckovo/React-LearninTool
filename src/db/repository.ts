import { getExpoDb, getExpoDbSync } from './database';
import * as schema from './schema';
import type { ChatSession, ChatMessage, ParsedAIResponse } from '@/lib/app-state';
import { dbLog } from './logger';

const { sessions, messages } = schema;

/** 最多保留的会话数量 */
const MAX_SESSIONS = 10;

function rowToChatMessage(row: Record<string, unknown>): ChatMessage {
  const parsedFlag = Number(row['parsed'] ?? 0);
  const hasSolution = row['solution'] != null;
  const hasRaw = row['raw'] != null;

  let parsed: ParsedAIResponse | undefined;
  if (parsedFlag === 1 || hasSolution || hasRaw) {
    parsed = {
      solution: (row['solution'] as string) ?? '',
      isPlottable: Number(row['is_plottable'] ?? 0) === 1,
      functionExpression: (row['function_expression'] as string) ?? null,
      raw: (row['raw'] as string) ?? '',
      parsed: parsedFlag === 1,
      parseError: (row['parse_error'] as string) ?? undefined,
    };
  }
  return {
    id: row['id'] as string,
    role: row['role'] as 'user' | 'assistant',
    content: row['content'] as string,
    parsed,
    timestamp: Number(row['timestamp'] ?? 0),
  };
}

/**
 * 获取所有会话（按 updatedAt DESC，最多 MAX_SESSIONS 条）。
 */
export async function getAllSessions(): Promise<ChatSession[]> {
  const db = getExpoDbSync();
  if (!db) {
    const awaited = await getExpoDb();
    return _getAllSessions(awaited);
  }
  return _getAllSessions(db);
}

async function _getAllSessions(client: import('expo-sqlite').SQLiteDatabase): Promise<ChatSession[]> {
  dbLog.debug(`查询所有会话 (LIMIT ${MAX_SESSIONS})...`);
  const rows = await client.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ?',
    [MAX_SESSIONS],
  );

  const result: ChatSession[] = [];
  for (const row of rows) {
    const msgRows = await client.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp',
      [row['id'] as string],
    );

    result.push({
      id: row['id'] as string,
      title: row['title'] as string,
      type: (row['type'] as string) ?? 'solver',
      messages: msgRows.map(rowToChatMessage),
      createdAt: Number(row['created_at'] ?? 0),
      updatedAt: Number(row['updated_at'] ?? 0),
    });
  }
  dbLog.debug(`查询到 ${result.length} 个会话`);
  return result;
}

/**
 * 创建新会话（含有首条消息时一并插入）。
 *
 * @param session 会话对象，type 字段默认为 'solver'
 */
export async function createSession(session: ChatSession): Promise<void> {
  const db = getExpoDbSync();
  if (!db) {
    dbLog.warn('createSession 跳过：DB 未初始化');
    return;
  }
  const sessionType = (session as Record<string, unknown>).type as string ?? 'solver';
  dbLog.debug(`创建会话 "${session.title}" (type=${sessionType}, id=${session.id.slice(0, 8)}...)`);
  await db.runAsync(
    'INSERT INTO sessions (id, title, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [session.id, session.title || '新对话', sessionType, session.createdAt || Date.now(), session.updatedAt || Date.now()],
  );
  if (session.messages.length > 0) {
    dbLog.debug(`  └─ 插入 ${session.messages.length} 条首条消息`);
    for (const msg of session.messages) {
      await addMessage(msg, session.id);
    }
  }
}

/**
 * 删除会话及其所有关联消息（CASCADE）。
 */
export async function deleteSession(id: string): Promise<void> {
  const db = getExpoDbSync();
  if (!db) return;
  dbLog.debug(`删除会话 (id=${id.slice(0, 8)}...)`);
  await db.runAsync('DELETE FROM sessions WHERE id = ?', [id]);
}

/**
 * 向指定会话添加一条消息，同时更新会话的 updatedAt。
 */
export async function addMessage(message: ChatMessage, sessionId: string): Promise<void> {
  const db = getExpoDbSync();
  if (!db) {
    dbLog.warn('addMessage 跳过：DB 未初始化');
    return;
  }
  dbLog.debug(
    `添加消息 (role=${message.role}, id=${message.id.slice(0, 8)}..., session=${sessionId.slice(0, 8)}...)`,
  );
  await db.runAsync(
    `INSERT INTO messages (id, session_id, role, content, solution, is_plottable, function_expression, raw, parsed, parse_error, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      message.id,
      sessionId,
      message.role,
      message.content,
      message.parsed?.solution ?? null,
      message.parsed?.isPlottable != null ? (message.parsed.isPlottable ? 1 : 0) : null,
      message.parsed?.functionExpression ?? null,
      message.parsed?.raw ?? null,
      message.parsed?.parsed ? 1 : 0,
      message.parsed?.parseError ?? null,
      message.timestamp,
    ],
  );

  await db.runAsync('UPDATE sessions SET updated_at = ? WHERE id = ?', [Date.now(), sessionId]);
}
