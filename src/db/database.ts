import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { dbLog } from './logger';

/** 懒初始化的 expo-sqlite 数据库实例 */
let _expoDb: SQLiteDatabase | null = null;

/** 初始化 Promise 一次性锁 */
let _dbPromise: Promise<SQLiteDatabase> | null = null;

/**
 * 获取 expo-sqlite 原生数据库实例（平台自适应懒初始化）。
 *
 * - Web：openDatabaseAsync（Worker + OPFS）
 * - Native：openDatabaseSync
 */
export function getExpoDb(): Promise<SQLiteDatabase> {
  if (_expoDb) return Promise.resolve(_expoDb);

  if (!_dbPromise) {
    _dbPromise = (async () => {
      const initPlatform = Platform.OS === 'web' ? 'web' : 'native';
      dbLog.info(`初始化数据库 (${initPlatform})...`);

      const { openDatabaseAsync, openDatabaseSync } = await import('expo-sqlite');

      if (Platform.OS === 'web') {
        _expoDb = await openDatabaseAsync('learntools.db');
      } else {
        _expoDb = openDatabaseSync('learntools.db');
      }

      dbLog.info(`数据库初始化完成 (${initPlatform})`);

      // 创建表结构
      await createTablesIfNeeded(_expoDb);

      return _expoDb;
    })();
  }

  return _dbPromise;
}

/**
 * 同步获取已初始化的 db 实例。未初始化时返回 null。
 */
export function getExpoDbSync(): SQLiteDatabase | null {
  return _expoDb;
}

/**
 * 创建数据库表（幂等）。
 */
async function createTablesIfNeeded(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      solution TEXT,
      is_plottable INTEGER,
      function_expression TEXT,
      raw TEXT,
      parsed INTEGER NOT NULL DEFAULT 0,
      parse_error TEXT,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);
    CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
  `);
}
