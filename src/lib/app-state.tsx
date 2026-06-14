import React, { createContext, useContext, useReducer, useEffect, type Dispatch } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

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

const STORAGE_KEY = '@learntools_sessions';
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
      } else {
        sessions = updateSession(
          { ...state, sessions, activeSessionId: sid },
          sid,
          (s) => ({ ...s, messages: [...s.messages, action.payload], updatedAt: Date.now(), title: s.title })
        ).sessions;
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

const AppContext = createContext<{
  state: AppState;
  dispatch: Dispatch<AppAction>;
  currentMessages: ChatMessage[];
} | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // 启动时从 AsyncStorage 恢复
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const sessions: ChatSession[] = JSON.parse(raw);
          dispatch({ type: 'LOAD_SESSIONS', payload: sessions });
        } else {
          dispatch({ type: 'LOAD_SESSIONS', payload: [] });
        }
      } catch {
        dispatch({ type: 'LOAD_SESSIONS', payload: [] });
      }
    })();
  }, []);

  // sessions 变更时持久化
  useEffect(() => {
    if (!state.loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.sessions)).catch(() => {});
  }, [state.sessions, state.loaded]);

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
