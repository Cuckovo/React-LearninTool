import React, { createContext, useContext, useReducer, useEffect, type Dispatch } from 'react';
import { getExpoDb } from '@/db/database';
import { dbLog } from '@/db/logger';
import { migrateFromAsyncStorage } from '@/db/migrate';
import { initializeDemoData } from '@/db/seed-outline';
import {
  getAllSessions,
  createSession,
  deleteSession as deleteSessionFromDb,
  addMessage,
} from '@/db/repository';
import type { ChatMode, SessionType } from '@/types/knowledge';

export interface ParsedAIResponse {
  solution: string;
  isPlottable: boolean;
  functionExpression: string | null;
  raw: string;
  parsed: boolean;
  parseError?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parsed?: ParsedAIResponse;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  type: SessionType;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface GeogebraPlotCommand {
  expression: string;
  timestamp: number;
}

export interface KnowledgeSessionPayload {
  nodeId: string;
  nodeLabel: string;
  standardDefinition: string | null;
  timestamp: number;
}

export interface AppState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isLoading: boolean;
  plotCommand: GeogebraPlotCommand | null;
  activeTab: 'geogebra' | 'ai-chat' | 'knowledge';
  loaded: boolean;
  /** 当前对话模式 */
  activeChatMode: ChatMode;
  /** 当前学习节点 ID（知识库模式） */
  activeKnowledgeNodeId: string | null;
}

type AppAction =
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SEND_PLOT_COMMAND'; payload: GeogebraPlotCommand }
  | { type: 'CLEAR_PLOT_COMMAND' }
  | { type: 'SET_ACTIVE_TAB'; payload: AppState['activeTab'] }
  | { type: 'NEW_SESSION' }
  | { type: 'SWITCH_SESSION'; payload: string }
  | { type: 'DELETE_SESSION'; payload: string }
  | { type: 'LOAD_SESSIONS'; payload: ChatSession[] }
  | { type: 'SET_CHAT_MODE'; payload: ChatMode }
  | { type: 'SET_KNOWLEDGE_NODE'; payload: string | null }
  | { type: 'CREATE_KNOWLEDGE_SESSION'; payload: KnowledgeSessionPayload }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; content: string; parsed?: ParsedAIResponse } };

const MAX_SESSIONS = 10;

const initialState: AppState = {
  sessions: [],
  activeSessionId: null,
  isLoading: false,
  plotCommand: null,
  activeTab: 'geogebra',
  loaded: false,
  activeChatMode: 'solver',
  activeKnowledgeNodeId: null,
};

function getCurrentMessages(state: AppState): ChatMessage[] {
  const session = state.sessions.find((s) => s.id === state.activeSessionId);
  return session?.messages ?? [];
}

function updateSession(state: AppState, sessionId: string, updater: (s: ChatSession) => ChatSession): AppState {
  return {
    ...state,
    sessions: state.sessions.map((s) => (s.id === sessionId ? updater(s) : s)),
  };
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_MESSAGE': {
      let sid = state.activeSessionId;
      let sessions = state.sessions;
      if (!sid) {
        // 首次发消息时自动创建 session
        sid = generateId();
        const title = action.payload.role === 'user' ? action.payload.content.slice(0, 20) : '新对话';
        const sessionType: SessionType = state.activeChatMode === 'knowledge' ? 'knowledge' : 'solver';
        const newSession: ChatSession = {
          id: sid,
          title,
          type: sessionType,
          messages: [action.payload],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        sessions = [newSession, ...state.sessions].slice(0, MAX_SESSIONS);
        // 持久化：创建新会话并添加首条消息
        persistCreateSession(newSession).catch((err) =>
          dbLog.error('创建会话持久化失败', err),
        );
      } else {
        sessions = updateSession(
          { ...state, sessions, activeSessionId: sid },
          sid,
          (s) => ({ ...s, messages: [...s.messages, action.payload], updatedAt: Date.now(), title: s.title })
        ).sessions;
        // 持久化：添加消息到已有会话
        persistAddMessage(action.payload, sid).catch((err) =>
          dbLog.error('添加消息持久化失败', err),
        );
      }
      return { ...state, sessions, activeSessionId: sid };
    }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'UPDATE_MESSAGE': {
      // 更新指定消息的内容和可选的 parsed 字段（用于流式传输后更新）
      const { id, content, parsed } = action.payload;
      let sessions = state.sessions;
      const sid = state.activeSessionId;
      if (!sid) return state;
      sessions = updateSession(
        { ...state, sessions, activeSessionId: sid },
        sid,
        (s) => ({
          ...s,
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, content, timestamp: Date.now(), ...(parsed !== undefined ? { parsed } : {}) } : m,
          ),
          updatedAt: Date.now(),
        }),
      ).sessions;
      return { ...state, sessions };
    }
    case 'SEND_PLOT_COMMAND':
      return { ...state, plotCommand: action.payload };
    case 'CLEAR_PLOT_COMMAND':
      return { ...state, plotCommand: null };
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'NEW_SESSION':
      return { ...state, activeSessionId: null, activeChatMode: 'solver', activeKnowledgeNodeId: null };
    case 'SWITCH_SESSION': {
      // 切换会话时根据 session.type 设置 chatMode
      const targetSession = state.sessions.find((s) => s.id === action.payload);
      const mode: ChatMode = targetSession?.type === 'knowledge' ? 'knowledge' : 'solver';
      return { ...state, activeSessionId: action.payload, activeChatMode: mode };
    }
    case 'DELETE_SESSION': {
      const filtered = state.sessions.filter((s) => s.id !== action.payload);
      // 持久化：删除会话
      persistDeleteSession(action.payload).catch((err) =>
        dbLog.error('删除会话持久化失败', err),
      );
      return {
        ...state,
        sessions: filtered,
        activeSessionId: state.activeSessionId === action.payload ? null : state.activeSessionId,
      };
    }
    case 'LOAD_SESSIONS':
      return { ...state, sessions: action.payload, loaded: true };
    case 'SET_CHAT_MODE': {
      const newMode = action.payload;
      // 切换模式时新建对应 type 的 session
      const newSessionId = generateId();
      const title = newMode === 'knowledge' ? '知识库学习' : '新对话';
      const sessionType: SessionType = newMode === 'knowledge' ? 'knowledge' : 'solver';
      const newSession: ChatSession = {
        id: newSessionId,
        title,
        type: sessionType,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const sessions = [newSession, ...state.sessions].slice(0, MAX_SESSIONS);
      persistCreateSession(newSession).catch((err) =>
        dbLog.error('创建会话持久化失败', err),
      );
      return {
        ...state,
        sessions,
        activeSessionId: newSessionId,
        activeChatMode: newMode,
        activeKnowledgeNodeId: newMode === 'knowledge' ? state.activeKnowledgeNodeId : null,
      };
    }
    case 'SET_KNOWLEDGE_NODE':
      return { ...state, activeKnowledgeNodeId: action.payload };
    case 'CREATE_KNOWLEDGE_SESSION': {
      const { nodeId, nodeLabel, standardDefinition } = action.payload;
      const newSessionId = generateId();
      const title = `学习: ${nodeLabel}`;
      const newSession: ChatSession = {
        id: newSessionId,
        title,
        type: 'knowledge',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const sessions = [newSession, ...state.sessions].slice(0, MAX_SESSIONS);
      persistCreateSession(newSession).catch((err) =>
        dbLog.error('创建知识库会话持久化失败', err),
      );
      return {
        ...state,
        sessions,
        activeSessionId: newSessionId,
        activeChatMode: 'knowledge',
        activeKnowledgeNodeId: nodeId,
      };
    }
    default:
      return state;
  }
}

// ── 持久化辅助函数（fire-and-forget） ──

  async function persistCreateSession(session: ChatSession): Promise<void> {
    try {
      await createSession(session);
    } catch (err) {
      dbLog.error('persistCreateSession 异常', err);
    }
  }

  async function persistAddMessage(message: ChatMessage, sessionId: string): Promise<void> {
    try {
      await addMessage(message, sessionId);
    } catch (err) {
      dbLog.error('persistAddMessage 异常', err);
    }
  }

  async function persistDeleteSession(id: string): Promise<void> {
    try {
      await deleteSessionFromDb(id);
    } catch (err) {
      dbLog.error('persistDeleteSession 异常', err);
    }
  }

const AppContext = createContext<{
  state: AppState;
  dispatch: Dispatch<AppAction>;
  currentMessages: ChatMessage[];
} | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // 启动时：初始化数据库，然后异步加载数据。
  // Web 端 expo-sqlite 使用 OPFS Worker 后端，所有 DB 操作必须串行。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 0. 初始化数据库连接（幂等，Web 端异步 Worker 初始化）
        const db = await getExpoDb();
        if (cancelled) return;
        // 1. 尝试从 AsyncStorage 迁移旧数据（幂等）
        await migrateFromAsyncStorage();
        if (cancelled) return;
        // 2. 初始化知识库种子数据（幂等，仅在 knowledge_nodes 为空时插入）
        dbLog.info('开始初始化知识库种子数据...');
        await initializeDemoData();
        if (cancelled) return;
        dbLog.info('知识库种子数据初始化完成');
        // 3. 从 SQLite 加载所有会话
        const sessions: ChatSession[] = await getAllSessions();
        if (cancelled) return;
        dbLog.info(`加载 ${sessions.length} 个会话`);
        dispatch({ type: 'LOAD_SESSIONS', payload: sessions });
      } catch (err) {
        if (!cancelled) {
          dbLog.error('加载会话失败', err);
          dispatch({ type: 'LOAD_SESSIONS', payload: [] });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const currentMessages = getCurrentMessages(state);

  return (
    <AppContext.Provider value={{ state, dispatch, currentMessages }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
