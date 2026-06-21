/**
 * DB 指令解析器。
 *
 * 从 AI 回复中提取 ```db 代码块，解析为可执行的 DBCommand，
 * 并通过 KnowledgeService 执行。
 */
import type { DBCommand } from '@/types/knowledge';
import { KnowledgeService } from '@/db/knowledge-service';
import { dbLog } from '@/db/logger';

/**
 * 从 AI 回复内容中提取所有 DB 指令。
 *
 * 识别格式：
 *   ```db
 *   { "action": "set_user_notes", "nodeId": "kn-...", "value": "笔记内容" }
 *   ```
 *
 * @param content AI 回复的完整文本
 * @returns 提取到的 DBCommand 数组
 */
export function extractDBCommands(content: string): DBCommand[] {
  const commands: DBCommand[] = [];

  // 匹配 ```db ... ``` 代码块
  const dbBlockRegex = /```db\s*\n?([\s\S]*?)\n?```/g;
  let match: RegExpExecArray | null;

  while ((match = dbBlockRegex.exec(content)) !== null) {
    const blockContent = match[1].trim();
    dbLog.debug(`extractDBCommands: 发现 db 块, 内容长度=${blockContent.length}`);
    try {
      const parsed = JSON.parse(blockContent);

      // 支持单个指令或指令数组
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        const cmd = validateCommand(item);
        if (cmd) {
          dbLog.info(`extractDBCommands: 解析到指令 action=${cmd.action}, nodeId=${cmd.nodeId}`);
          commands.push(cmd);
        }
      }
    } catch (err) {
      // JSON 解析失败，跳过该代码块
      dbLog.warn('extractDBCommands: JSON 解析失败', { blockContent: blockContent.slice(0, 200), err });
      continue;
    }
  }

  if (commands.length === 0) {
    dbLog.debug('extractDBCommands: AI 回复中未发现 db 指令块');
  }

  return commands;
}

/**
 * 验证并规范化单个指令对象。
 */
function validateCommand(item: unknown): DBCommand | null {
  if (typeof item !== 'object' || item === null) return null;

  const obj = item as Record<string, unknown>;
  const action = obj['action'] as string | undefined;
  const nodeId = obj['nodeId'] as string | undefined;

  if (!action || !nodeId) return null;

  const validActions = ['set_user_notes', 'set_mastery', 'get_node', 'get_children'];
  if (!validActions.includes(action)) return null;

  return {
    action: action as DBCommand['action'],
    nodeId,
    value: typeof obj['value'] === 'string' ? obj['value'] : undefined,
    parentId: typeof obj['parentId'] === 'string' ? obj['parentId'] : undefined,
  };
}

/**
 * 执行单个 DBCommand。
 *
 * @param service KnowledgeService 实例
 * @param command 待执行的指令
 */
export async function executeDBCommand(
  service: KnowledgeService,
  command: DBCommand,
): Promise<unknown> {
  dbLog.info(`executeDBCommand: action=${command.action}, nodeId=${command.nodeId}${command.value != null ? `, valueLen=${command.value.length}` : ''}`);
  switch (command.action) {
    case 'set_user_notes':
      if (command.value != null) {
        await service.setUserNotes(command.nodeId, command.value);
        return { success: true, action: 'set_user_notes', nodeId: command.nodeId };
      }
      return { success: false, error: 'set_user_notes 缺少 value 参数' };

    case 'set_mastery':
      if (
        command.value != null &&
        ['not_started', 'learning', 'passed', 'mastered'].includes(command.value)
      ) {
        await service.updateMastery(command.nodeId, command.value as 'not_started' | 'learning' | 'passed' | 'mastered');
        return { success: true, action: 'set_mastery', nodeId: command.nodeId, value: command.value };
      }
      return { success: false, error: 'set_mastery 的 value 必须是 not_started/learning/passed/mastered 之一' };

    case 'get_node': {
      const node = await service.getNode(command.nodeId);
      return { success: true, action: 'get_node', node };
    }

    case 'get_children': {
      const children = await service.getChildrenOf(command.nodeId);
      return { success: true, action: 'get_children', children };
    }

    default:
      return { success: false, error: `未知指令: ${(command as DBCommand).action}` };
  }
}

/**
 * 批量执行 DBCommand 数组。
 *
 * @param service KnowledgeService 实例
 * @param commands 指令数组
 * @returns 每条指令的执行结果数组
 */
export async function executeDBCommands(
  service: KnowledgeService,
  commands: DBCommand[],
): Promise<unknown[]> {
  const results: unknown[] = [];
  for (const cmd of commands) {
    try {
      const result = await executeDBCommand(service, cmd);
      results.push(result);
    } catch (err) {
      results.push({
        success: false,
        action: cmd.action,
        nodeId: cmd.nodeId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}
