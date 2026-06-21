/**
 * 数据库日志模块。
 *
 * 通过 .env 中的 EXPO_PUBLIC_DB_LOG_LEVEL 控制输出级别：
 *   none  — 关闭所有日志
 *   error — 仅输出错误
 *   warn  — 输出警告及以上
 *   info  — 输出信息及以上（默认）
 *   debug — 输出所有（含调试细节）
 */

type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';

const LEVEL_ORDER: Record<LogLevel, number> = {
  none: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

/** 从环境变量读取日志级别，默认 info。
 *  开发模式下（__DEV__），若未显式设置则默认为 debug。 */
function getLevel(): LogLevel {
  const raw = process.env.EXPO_PUBLIC_DB_LOG_LEVEL as string | undefined;
  if (raw) {
    const normalized = raw.toLowerCase();
    if (normalized in LEVEL_ORDER) return normalized as LogLevel;
  }
  // 开发模式下默认 debug，生产环境默认 info
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return 'debug';
  }
  return 'info';
}

const currentLevel = getLevel();

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[currentLevel] >= LEVEL_ORDER[level];
}

/* eslint-disable no-console */
export const dbLog = {
  error: (msg: string, ...args: unknown[]) => {
    if (shouldLog('error')) console.error(`[DB:ERROR] ${msg}`, ...args);
  },
  warn: (msg: string, ...args: unknown[]) => {
    if (shouldLog('warn')) console.warn(`[DB:WARN] ${msg}`, ...args);
  },
  info: (msg: string, ...args: unknown[]) => {
    if (shouldLog('info')) console.log(`[DB:INFO] ${msg}`, ...args);
  },
  debug: (msg: string, ...args: unknown[]) => {
    if (shouldLog('debug')) console.log(`[DB:DEBUG] ${msg}`, ...args);
  },
};
/* eslint-enable no-console */
