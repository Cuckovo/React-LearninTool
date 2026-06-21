import React, { createContext, useContext, useReducer, useEffect, type Dispatch } from 'react';
import { getExpoDb } from '@/db/database';
import { dbLog } from '@/db/logger';
import { migrateFromAsyncStorage } from '@/db/migrate';
import {
  getAllSessions,
  createSession,
  deleteSession as deleteSessionFromDb,
  addMessage,
} from '@/db/repository';

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
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface GeogebraPlotCommand {
  expression: string;
  timestamp: number;
}

export interface AppState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isLoading: boolean;
  plotCommand: GeogebraPlotCommand | null;
  activeTab: 'geogebra' | 'ai-chat' | 'more';
  loaded: boolean;
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
  | { type: 'LOAD_SESSIONS'; payload: ChatSession[] };

const MAX_SESSIONS = 10;

const initialState: AppState = {
  sessions: [],
  activeSessionId: null,
  isLoading: false,
  plotCommand: null,
  activeTab: 'geogebra',
  loaded: false,
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
        const newSession: ChatSession = {
          id: sid,
          title,
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
    case 'SEND_PLOT_COMMAND':
      return { ...state, plotCommand: action.payload };
    case 'CLEAR_PLOT_COMMAND':
      return { ...state, plotCommand: null };
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'NEW_SESSION':
      return { ...state, activeSessionId: null };
    case 'SWITCH_SESSION':
      return { ...state, activeSessionId: action.payload };
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

  // 启动时：先初始化数据库，再执行数据迁移，最后从 SQLite 加载数据
  useEffect(() => {
    (async () => {
      try {
        // 0. 懒初始化数据库连接（Web 端需要异步上下文）
        await getExpoDb();
        // 1. 尝试从 AsyncStorage 迁移旧数据（幂等）
        await migrateFromAsyncStorage();
        // 2. 从 SQLite 加载所有会话
        const sessions: ChatSession[] = await getAllSessions();
        dbLog.info(`加载 ${sessions.length} 个会话`);
        dispatch({ type: 'LOAD_SESSIONS', payload: sessions });
      } catch (err) {
        dbLog.error('加载会话失败', err);
        dispatch({ type: 'LOAD_SESSIONS', payload: [] });
      }
    })();
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
