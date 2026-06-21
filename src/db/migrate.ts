import AsyncStorage from '@react-native-async-storage/async-storage';
import { getExpoDbSync, getExpoDb } from './database';
import type { ChatSession, ChatMessage } from '@/lib/app-state';
import { dbLog } from './logger';

/** 旧 AsyncStorage 键名 */
const LEGACY_STORAGE_KEY = '@learntools_sessions';

/**
 * 检查数据库是否已有 sessions 数据
 */
async function hasExistingData(): Promise<boolean> {
  try {
    const db = getExpoDbSync();
    if (!db) return false;
    const result = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM sessions');
    return (result?.count ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * 从 AsyncStorage 迁移数据到 SQLite。
 *
 * 幂等性：如果数据库已有 session 数据则跳过。
 * 错误处理：迁移过程中的错误会被记录但不会抛出，不会阻塞应用启动。
 */
export async function migrateFromAsyncStorage(): Promise<number> {
  try {
    const alreadyMigrated = await hasExistingData();
    if (alreadyMigrated) {
      dbLog.debug('数据迁移跳过：SQLite 已有数据');
      return 0;
    }

    const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      dbLog.debug('数据迁移跳过：AsyncStorage 无旧数据');
      return 0;
    }

    const oldSessions: ChatSession[] = JSON.parse(raw);
    if (!Array.isArray(oldSessions) || oldSessions.length === 0) {
      dbLog.debug('数据迁移跳过：AsyncStorage 数据为空数组');
      return 0;
    }

    dbLog.info(`开始迁移 ${oldSessions.length} 个旧会话...`);

    const db = getExpoDbSync() ?? (await getExpoDb());
    let migratedSessions = 0;
    let migratedMessages = 0;

    for (const s of oldSessions) {
      try {
        await db.runAsync(
          'INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
          [s.id, s.title || '新对话', s.createdAt || Date.now(), s.updatedAt || Date.now()],
        );

        if (Array.isArray(s.messages) && s.messages.length > 0) {
          for (const msg of s.messages) {
            await db.runAsync(
              `INSERT INTO messages (id, session_id, role, content, solution, is_plottable, function_expression, raw, parsed, parse_error, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                msg.id,
                s.id,
                msg.role,
                msg.content,
                msg.parsed?.solution ?? null,
                msg.parsed?.isPlottable != null ? (msg.parsed.isPlottable ? 1 : 0) : null,
                msg.parsed?.functionExpression ?? null,
                msg.parsed?.raw ?? null,
                msg.parsed?.parsed ? 1 : 0,
                msg.parsed?.parseError ?? null,
                msg.timestamp,
              ],
            );
            migratedMessages++;
          }
        }

        migratedSessions++;
      } catch (sessionErr) {
        dbLog.error(`迁移会话 "${s.id}" 失败`, sessionErr);
      }
    }

    if (migratedSessions > 0) {
      dbLog.info(`数据迁移完成：${migratedSessions} 个会话、${migratedMessages} 条消息`);
    }

    return migratedSessions;
  } catch (err) {
    dbLog.error('数据迁移失败', err);
    return 0;
  }
}
