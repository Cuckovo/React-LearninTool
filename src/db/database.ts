import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { dbLog } from './logger';

/** 懒初始化的 expo-sqlite 数据库实例 */
let _expoDb: SQLiteDatabase | null = null;

/** 初始化 Promise 一次性锁 */
let _dbPromise: Promise<SQLiteDatabase> | null = null;

/** 上一次网络 ping 的时间戳，用于检测 reload 场景 */
let _lastPing: number = 0;

/** 单例锁：防止 StrictMode 或热重载导致双重初始化 */
let _initLock = false;

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
      // Web 端 StrictMode / 热重载保护：如果初始化正在进行中，第二个调用者等待
      while (_initLock) {
        await new Promise(resolve => setTimeout(resolve, 50));
        if (_expoDb) {
          dbLog.info('数据库初始化：检测到并发等待，复用已初始化的实例');
          return _expoDb;
        }
      }
      _initLock = true;

      const initPlatform = Platform.OS === 'web' ? 'web' : 'native';
      dbLog.info(`初始化数据库 (${initPlatform})...`);

      try {
        const { openDatabaseAsync, openDatabaseSync } = await import('expo-sqlite');

        if (Platform.OS === 'web') {
          _expoDb = await openDatabaseAsync('learntools.db');
        } else {
          _expoDb = openDatabaseSync('learntools.db');
        }

        dbLog.info(`数据库初始化完成 (${initPlatform})`);

        // 启用外键约束（expo-sqlite 默认不启用）
        await _expoDb.execAsync('PRAGMA foreign_keys = ON');

        // 创建表结构
        await createTablesIfNeeded(_expoDb);

        // 执行增量迁移
        await runMigrations(_expoDb);
      } finally {
        _initLock = false;
      }

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

    CREATE TABLE IF NOT EXISTS knowledge_nodes (
      id TEXT PRIMARY KEY NOT NULL,
      parent_id TEXT,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      standard_definition TEXT,
      user_notes TEXT,
      mastery_status TEXT NOT NULL DEFAULT 'not_started',
      metadata TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_nodes_parent ON knowledge_nodes(parent_id);
    CREATE INDEX IF NOT EXISTS idx_nodes_type ON knowledge_nodes(type);
    CREATE INDEX IF NOT EXISTS idx_nodes_label ON knowledge_nodes(label);

    CREATE TABLE IF NOT EXISTS agent_logs (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT,
      payload TEXT,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_logs_session ON agent_logs(session_id);
  `);
}

/**
 * 增量迁移：为存量表增加新列、填充默认值。
 *
 * 迁移策略：每条迁移使用 try/catch 包裹，幂等 — 已存在的列不会重复添加。
 */
async function runMigrations(db: SQLiteDatabase): Promise<void> {
  try {
    // Migration 1: sessions 表新增 type 列（solver / knowledge）
    await db.execAsync(`ALTER TABLE sessions ADD COLUMN type TEXT DEFAULT 'solver' NOT NULL`);
    dbLog.info('Migration 1: sessions.type 列已添加');
  } catch {
    // 列已存在，跳过
    dbLog.debug('Migration 1: sessions.type 列已存在，跳过');
  }

  // 填充存量会话的 type 默认值（NULL → 'solver'）
  try {
    const result = await db.runAsync("UPDATE sessions SET type = 'solver' WHERE type IS NULL");
    if (result.changes > 0) {
      dbLog.info(`Migration 2: 填充 ${result.changes} 条 sessions.type 默认值`);
    }
  } catch {
    dbLog.debug('Migration 2: sessions.type NULL 填充跳过（无需操作）');
  }
}
