# LearnTools — 数据库驱动架构迁移方案

> **版本**: 1.0 | **日期**: 2026-06-21 | **作者**: Senior Developer (吴八哥)

---

## 一、方案结论

### 推荐技术栈

| 组件 | 选型 | 理由 |
|------|------|------|
| **数据库引擎** | `expo-sqlite` (Expo SDK 56 内置) | Android + Web 双端原生支持，零额外 native module |
| **ORM 层** | `drizzle-orm` + `drizzle-kit` | 类型安全 SQL 链式查询，Agent 可自由组装 CRUD |
| **Schema 校验** | `drizzle-zod` | 与 Zod 深度集成，输入校验零成本 |
| **迁移管理** | `drizzle-kit generate` | 声明式 schema → 自动生成 SQL migration |

### 为什么是 expo-sqlite + Drizzle 而不是其他？

| 候选方案 | 致命问题 |
|----------|----------|
| **WatermelonDB** | 需要 `expo-dev-client` + 自定义插件，与 Expo SDK 56 兼容性存疑 |
| **Realm** | SDK 30+ 后不再维护 RN 绑定，Expo 56 无法使用 |
| **纯 expo-sqlite** | 手写 SQL 字符串容易出错，缺乏类型安全保障 |
| **PouchDB/CouchDB** | 太重，不适合移动端嵌入场景 |

---

## 二、数据模型设计

### ER 图

```
┌─────────────────┐       ┌──────────────────┐
│    sessions     │──────<│    messages      │
│─────────────────│  1:N  │──────────────────│
│ id       text PK│       │ id       text PK │
│ title    text   │       │ session_id text  │── FK → sessions.id
│ created_at int  │       │ role     text    │
│ updated_at int  │       │ content  text    │
└─────────────────┘       │ parsed   text    │── JSON (ParsedAIResponse)
                          │ created_at int   │
           ┌──────────────┴──────────────────┘
           │
           │ 1:N
           ▼
┌──────────────────┐       ┌──────────────────────┐
│   agent_logs     │       │  knowledge_nodes     │
│──────────────────│       │──────────────────────│
│ id       text PK │       │ id          text PK  │
│ session_id text  │       │ parent_id   text     │── 自引用树
│ msg_id   text    │       │ type        text     │   (subject/chapter/concept)
│ action   text    │       │ label       text     │
│ target_tbl text  │       │ content     text     │
│ payload  text    │ JSON  │ metadata    text     │── JSON
│ result   text    │ JSON  │ order       int      │
│ ts       int     │       │ created_at  int      │
└──────────────────┘       │ updated_at  int      │
                           └──────────────────────┘

┌──────────────────────┐
│  function_bookmarks  │
│──────────────────────│
│ id          text PK  │
│ msg_id      text     │── FK → messages.id (optional)
│ expression  text     │   e.g. "f(x)=sin(x)"
│ note        text     │
│ created_at  int      │
└──────────────────────┘
```

### Drizzle Schema 定义

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// ── sessions ──
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// ── messages ──
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  parsed: text('parsed'), // JSON string of ParsedAIResponse
  createdAt: integer('created_at').notNull(),
});

// ── agent_logs ──
export const agentLogs = sqliteTable('agent_logs', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
  msgId: text('msg_id'),
  action: text('action', { enum: ['create', 'read', 'update', 'delete', 'query'] }).notNull(),
  targetTable: text('target_table').notNull(),
  payload: text('payload'), // JSON string
  result: text('result'),   // JSON string
  ts: integer('ts').notNull(),
});

// ── knowledge_nodes (树形结构) ──
export const knowledgeNodes = sqliteTable('knowledge_nodes', {
  id: text('id').primaryKey(),
  parentId: text('parent_id'), // null = root node
  type: text('type', { enum: ['subject', 'chapter', 'concept', 'formula', 'note'] }).notNull(),
  label: text('label').notNull(),
  content: text('content'),
  metadata: text('metadata'), // JSON: {tags, difficulty, source...}
  order: integer('order').default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// ── function_bookmarks ──
export const functionBookmarks = sqliteTable('function_bookmarks', {
  id: text('id').primaryKey(),
  msgId: text('msg_id'),
  expression: text('expression').notNull(),
  note: text('note'),
  createdAt: integer('created_at').notNull(),
});
```

---

## 三、Agent ↔ DB 交互设计

### 3.1 核心抽象 — DatabaseService

```typescript
// src/db/service.ts
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { eq, like, desc, and, or } from 'drizzle-orm';
import * as schema from './schema';

export class DatabaseService {
  private db: ReturnType<typeof drizzle>;

  constructor(sqliteDb: any) {
    this.db = drizzle(sqliteDb, { schema });
  }

  // ── Session CRUD ──
  async getSessions(limit = 10) {
    return this.db.select().from(schema.sessions)
      .orderBy(desc(schema.sessions.updatedAt))
      .limit(limit);
  }

  async getSession(id: string) {
    return this.db.select().from(schema.sessions)
      .where(eq(schema.sessions.id, id))
      .get();
  }

  async createSession(session: typeof schema.sessions.$inferInsert) {
    await this.db.insert(schema.sessions).values(session);
    return session;
  }

  async deleteSession(id: string) {
    await this.db.delete(schema.sessions).where(eq(schema.sessions.id, id));
  }

  // ── Message CRUD ──
  async getMessages(sessionId: string, limit = 100) {
    return this.db.select().from(schema.messages)
      .where(eq(schema.messages.sessionId, sessionId))
      .orderBy(schema.messages.createdAt)
      .limit(limit);
  }

  async addMessage(msg: typeof schema.messages.$inferInsert) {
    await this.db.insert(schema.messages).values(msg);
    return msg;
  }

  // ── Agent 日志 ──
  async logAction(log: typeof schema.agentLogs.$inferInsert) {
    await this.db.insert(schema.agentLogs).values(log);
  }

  async getAgentLogs(sessionId: string, limit = 50) {
    return this.db.select().from(schema.agentLogs)
      .where(eq(schema.agentLogs.sessionId, sessionId))
      .orderBy(desc(schema.agentLogs.ts))
      .limit(limit);
  }

  // ── Knowledge Node CRUD (Agent 按节点操作) ──
  async getNodeTree(parentId: string | null = null) {
    const condition = parentId === null
      ? schema.knowledgeNodes.parentId === null as any
      : eq(schema.knowledgeNodes.parentId, parentId);

    return this.db.select().from(schema.knowledgeNodes)
      .where(condition)
      .orderBy(schema.knowledgeNodes.order);
  }

  async createNode(node: typeof schema.knowledgeNodes.$inferInsert) {
    await this.db.insert(schema.knowledgeNodes).values(node);
    return node;
  }

  async updateNode(id: string, updates: Partial<typeof schema.knowledgeNodes.$inferInsert>) {
    await this.db.update(schema.knowledgeNodes)
      .set({ ...updates, updatedAt: Date.now() })
      .where(eq(schema.knowledgeNodes.id, id));
  }

  async deleteNode(id: string) {
    await this.db.delete(schema.knowledgeNodes)
      .where(eq(schema.knowledgeNodes.id, id));
  }

  async searchNodes(keyword: string) {
    return this.db.select().from(schema.knowledgeNodes)
      .where(like(schema.knowledgeNodes.label, `%${keyword}%`));
  }
}
```

### 3.2 Agent 节点化操作模式

Agent 通过结构化的 action 指令与 DB 交互：

```typescript
// Agent 发起操作请求
interface AgentDBAction {
  action: 'create' | 'read' | 'update' | 'delete' | 'query';
  target: 'sessions' | 'messages' | 'knowledge_nodes' | 'function_bookmarks';
  params: Record<string, unknown>;
  sessionId: string;
}

// 示例 1: Agent 查询某会话的全部消息
const action1: AgentDBAction = {
  action: 'query',
  target: 'messages',
  params: { sessionId: 'abc123', limit: 50 },
  sessionId: 'abc123',
};

// 示例 2: Agent 创建知识节点
const action2: AgentDBAction = {
  action: 'create',
  target: 'knowledge_nodes',
  params: {
    id: 'node-001',
    parentId: null,
    type: 'subject',
    label: '高等数学',
    content: '高等数学知识体系',
    order: 0,
  },
  sessionId: 'abc123',
};

// 示例 3: Agent 更新知识节点
const action3: AgentDBAction = {
  action: 'update',
  target: 'knowledge_nodes',
  params: {
    id: 'node-001',
    updates: { label: '高等数学 (上)', content: '微积分 + 线性代数' },
  },
  sessionId: 'abc123',
};
```

### 3.3 Agent 执行管道

```
User Input (自然语言)
        │
        ▼
┌───────────────────────────┐
│    AI 解析用户意图         │
│  识别 CRUD 操作意图        │
│  提取 target + params     │
└───────────┬───────────────┘
            │
            ▼
┌───────────────────────────┐
│   AgentDBAction 构造      │
│  Zod Schema 校验参数      │
└───────────┬───────────────┘
            │
            ▼
┌───────────────────────────┐
│   DatabaseService 执行    │
│  写入 agent_logs          │
│  返回 result              │
└───────────┬───────────────┘
            │
            ▼
┌───────────────────────────┐
│   AI 生成自然语言反馈      │
│  "已创建知识节点: 高等数学" │
└───────────────────────────┘
```

---

## 四、渐进式迁移策略

### Phase 1: 双写期 (1 周)

```
新数据 → 同时写入 AsyncStorage + SQLite
旧数据读取 → 先从 SQLite 读，fallback 到 AsyncStorage
```

- 安装 `expo-sqlite` + `drizzle-orm` + `drizzle-zod`
- 创建 schema + migration
- 实现 `DatabaseService`
- 在 `AppStateProvider` 中添加双写逻辑

### Phase 2: 历史数据迁移 (1-2 天)

```typescript
async function migrateFromAsyncStorage(db: DatabaseService) {
  const raw = await AsyncStorage.getItem('@learntools_sessions');
  if (!raw) return;
  const sessions: ChatSession[] = JSON.parse(raw);

  for (const s of sessions) {
    await db.createSession({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    });
    for (const m of s.messages) {
      await db.addMessage({
        id: m.id,
        sessionId: s.id,
        role: m.role,
        content: m.content,
        parsed: m.parsed ? JSON.stringify(m.parsed) : null,
        createdAt: m.timestamp,
      });
    }
  }
}
```

### Phase 3: 切换为主存储 (1 周)

- 所有读写只走 SQLite
- 移除 AsyncStorage 依赖
- 实现 `knowledge_nodes` + `agent_logs` 功能
- Agent 交互功能上线

---

## 五、依赖安装清单

```bash
npx expo install expo-sqlite
npm install drizzle-orm drizzle-zod
npm install -D drizzle-kit @types/better-sqlite3
```

`package.json` 新增依赖：

```json
{
  "dependencies": {
    "expo-sqlite": "~56.0.2",
    "drizzle-orm": "^0.39.1",
    "drizzle-zod": "^0.6.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30.4"
  }
}
```

---

## 六、文件结构变更

```
src/
├── db/                           # 新增：数据库层
│   ├── schema.ts                 # Drizzle schema 定义
│   ├── service.ts                # DatabaseService 封装
│   ├── agent-actions.ts          # Agent 操作解析 & 执行
│   ├── migrations/               # drizzle-kit 生成的迁移
│   │   └── 0000_initial.sql
│   └── migrate.ts                # 迁移执行 + AsyncStorage 导入
│
├── lib/
│   ├── app-state.tsx             # 改造：useReducer → DatabaseService
│   ├── api.ts                    # 保留 (DeepSeek 不变)
│   └── ai-parser.ts              # 保留 (解析逻辑不变)
│
├── app/
│   ├── _layout.tsx               # 改造：初始化 DB 连接
│   ├── index.tsx                 # 保留
│   ├── ai-chat.tsx               # 改造：消息走 DB
│   └── more.tsx                  # 改造：知识节点管理
```

---

## 七、风险评估与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Expo SDK 56 中 expo-sqlite API 变更 | 低 | 中 | 查阅 [Expo SDK 56 官方文档](https://docs.expo.dev/versions/v56.0.0/sdk/sqlite/) 确认 API 兼容 |
| drizzle-orm 与 expo-sqlite 集成 bug | 低 | 高 | drizzle 官方支持 `expo-sqlite` driver，已有成熟案例 |
| 历史数据迁移丢失 | 中 | 高 | Phase 1 双写验证通过后再删 AsyncStorage 数据 |
| SQLite 性能瓶颈 (大量消息) | 低 | 低 | SQLite 单表百万级无压力，消息量不会超过 10 万 |

---

## 八、总结

**推荐方案：expo-sqlite + Drizzle ORM**

这套方案的核心优势：

1. **零额外原生依赖** — expo-sqlite 是 Expo SDK 56 内置模块
2. **类型安全** — Drizzle 提供完整的 TypeScript 类型推导
3. **Agent 友好** — Drizzle 链式 API 天然支持 Agent 按节点组装 CRUD
4. **可审计** — agent_logs 表记录每次数据库操作
5. **可扩展** — knowledge_nodes 树形结构为未来 RAG 做准备
6. **渐进迁移** — 可以与现有 AsyncStorage 并存，逐步切换

预计总工期：**2-3 周**（含双写验证 + 历史数据迁移 + Agent 交互功能）
