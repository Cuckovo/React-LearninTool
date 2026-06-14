import React, { createContext, useContext, useReducer, type Dispatch } from 'react';

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

export interface GeogebraPlotCommand {
  expression: string;
  timestamp: number;
}

export interface AppState {
  messages: ChatMessage[];
  isLoading: boolean;
  plotCommand: GeogebraPlotCommand | null;
  activeTab: 'geogebra' | 'ai-chat' | 'more';
}

type AppAction =
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SEND_PLOT_COMMAND'; payload: GeogebraPlotCommand }
  | { type: 'CLEAR_PLOT_COMMAND' }
  | { type: 'SET_ACTIVE_TAB'; payload: AppState['activeTab'] };

const initialState: AppState = {
  messages: [],
  isLoading: false,
  plotCommand: null,
  activeTab: 'geogebra',
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SEND_PLOT_COMMAND':
      return { ...state, plotCommand: action.payload };
    case 'CLEAR_PLOT_COMMAND':
      return { ...state, plotCommand: null };
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    default:
      return state;
  }
}

const AppContext = createContext<{ state: AppState; dispatch: Dispatch<AppAction> } | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
