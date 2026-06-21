/**
 * KnowledgeService — 知识库数据服务层。
 *
 * 提供知识树的 CRUD、进度统计、Agent 日志写入等功能。
 * 使用现有 getExpoDb() / getExpoDbSync() 模式获取数据库实例。
 */
import { getExpoDb, getExpoDbSync } from './database';
import type { SQLiteDatabase } from 'expo-sqlite';
import { dbLog } from './logger';
import { generateId } from '@/lib/app-state';
import { initializeDemoData } from './seed-outline';
import type {
  KnowledgeNode,
  TreeNode,
  ProgressStats,
  MasteryStatus,
  NodeType,
} from '@/types/knowledge';

/** 将原始行映射为 KnowledgeNode */
function rowToKnowledgeNode(row: Record<string, unknown>): KnowledgeNode {
  return {
    id: row['id'] as string,
    parentId: (row['parent_id'] as string) ?? null,
    type: row['type'] as NodeType,
    label: row['label'] as string,
    standardDefinition: (row['standard_definition'] as string) ?? null,
    userNotes: (row['user_notes'] as string) ?? null,
    masteryStatus: (row['mastery_status'] as MasteryStatus) ?? 'not_started',
    metadata: row['metadata'] != null ? JSON.parse(row['metadata'] as string) : null,
    sortOrder: Number(row['sort_order'] ?? 0),
    createdAt: Number(row['created_at'] ?? 0),
    updatedAt: Number(row['updated_at'] ?? 0),
  };
}

/** 获取数据库实例（异步），未初始化时返回 null */
async function getDb(): Promise<SQLiteDatabase | null> {
  try {
    return await getExpoDb();
  } catch {
    return null;
  }
}

/** 获取数据库实例（同步），未初始化时返回 null */
function getDbSync(): SQLiteDatabase | null {
  return getExpoDbSync();
}

export class KnowledgeService {
  /**
   * 获取从根节点开始的完整知识树（递归构建 TreeNode[]）。
   */
  async getFullTree(): Promise<TreeNode[]> {
    const db = await getDb();
    if (!db) {
      dbLog.warn('getFullTree 跳过：DB 未初始化');
      return [];
    }
    const rootNodes = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM knowledge_nodes WHERE parent_id IS NULL ORDER BY sort_order',
    );
    const result: TreeNode[] = [];
    for (const row of rootNodes) {
      const node = rowToKnowledgeNode(row);
      const children = await this._getChildrenRecursive(node.id, db);
      result.push({ node, children });
    }
    return result;
  }

  /** 递归获取子节点 */
  private async _getChildrenRecursive(
    parentId: string,
    db: SQLiteDatabase,
  ): Promise<TreeNode[]> {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM knowledge_nodes WHERE parent_id = ? ORDER BY sort_order',
      [parentId],
    );
    const result: TreeNode[] = [];
    for (const row of rows) {
      const node = rowToKnowledgeNode(row);
      const children = await this._getChildrenRecursive(node.id, db);
      result.push({ node, children });
    }
    return result;
  }

  /**
   * 获取指定 ID 的单个节点。
   */
  async getNode(id: string): Promise<KnowledgeNode | null> {
    const db = await getDb();
    if (!db) return null;
    const row = await db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM knowledge_nodes WHERE id = ?',
      [id],
    );
    if (!row) return null;
    return rowToKnowledgeNode(row);
  }

  /**
   * 获取某节点的直接子节点（不递归）。
   */
  async getChildrenOf(parentId: string): Promise<KnowledgeNode[]> {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM knowledge_nodes WHERE parent_id = ? ORDER BY sort_order',
      [parentId],
    );
    return rows.map(rowToKnowledgeNode);
  }

  /**
   * 设置节点的用户笔记（防抖写入）。
   */
  async setUserNotes(id: string, notes: string): Promise<void> {
    const db = getDbSync();
    if (!db) {
      dbLog.warn('setUserNotes 跳过：DB 未初始化');
      return;
    }
    await db.runAsync(
      'UPDATE knowledge_nodes SET user_notes = ?, updated_at = ? WHERE id = ?',
      [notes, Date.now(), id],
    );
  }

  /**
   * 设置节点的标准定义（Agent 或种子数据写入）。
   */
  async setStandardDefinition(id: string, def: string): Promise<void> {
    const db = getDbSync();
    if (!db) {
      dbLog.warn('setStandardDefinition 跳过：DB 未初始化');
      return;
    }
    await db.runAsync(
      'UPDATE knowledge_nodes SET standard_definition = ?, updated_at = ? WHERE id = ?',
      [def, Date.now(), id],
    );
  }

  /**
   * 更新节点的掌握状态。
   */
  async updateMastery(id: string, status: MasteryStatus): Promise<void> {
    const db = getDbSync();
    if (!db) {
      dbLog.warn('updateMastery 跳过：DB 未初始化');
      return;
    }
    await db.runAsync(
      'UPDATE knowledge_nodes SET mastery_status = ?, updated_at = ? WHERE id = ?',
      [status, Date.now(), id],
    );
  }

  /**
   * 获取整棵知识树的进度统计（仅统计叶子节点 — concept 类型）。
   */
  async getProgress(): Promise<ProgressStats> {
    const db = await getDb();
    if (!db) {
      return { totalLeafNodes: 0, passed: 0, learning: 0, notStarted: 0, percentage: 0 };
    }
    // 叶子节点 = concept 类型且没有子节点
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT mastery_status FROM knowledge_nodes
       WHERE type = 'concept'
         AND id NOT IN (SELECT DISTINCT parent_id FROM knowledge_nodes WHERE parent_id IS NOT NULL)`,
    );
    const totalLeafNodes = rows.length;
    let passed = 0;
    let learning = 0;
    let notStarted = 0;
    for (const row of rows) {
      const status = row['mastery_status'] as string;
      if (status === 'passed' || status === 'mastered') {
        passed++;
      } else if (status === 'learning') {
        learning++;
      } else {
        notStarted++;
      }
    }
    const percentage = totalLeafNodes > 0 ? Math.round((passed / totalLeafNodes) * 100) : 0;
    return { totalLeafNodes, passed, learning, notStarted, percentage };
  }

  /**
   * 写入 Agent 操作日志（Demo 阶段不展示 UI，仅控制台输出）。
   */
  async logAgentAction(
    action: string,
    sessionId: string,
    target?: string,
    payload?: string,
  ): Promise<void> {
    const db = getDbSync();
    if (!db) {
      dbLog.warn('logAgentAction 跳过：DB 未初始化');
      return;
    }
    const id = generateId();
    await db.runAsync(
      'INSERT INTO agent_logs (id, session_id, action, target, payload, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [id, sessionId, action, target ?? null, payload ?? null, Date.now()],
    );
    dbLog.debug(`Agent 日志: action=${action}, target=${target ?? '-'}`);
  }

  /**
   * 初始化 Demo 种子数据（幂等 — 调用 seed-outline.ts 中的实现）。
   */
  async initializeDemoData(): Promise<void> {
    await initializeDemoData();
  }
}
