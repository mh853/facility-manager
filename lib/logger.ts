// lib/logger.ts - 환경별 로깅 시스템

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private enableDebug: boolean;

  private constructor() {
    // 환경 변수로 로그 레벨 설정
    const envLogLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
    this.logLevel = envLogLevel || (process.env.NODE_ENV === 'production' ? 'warn' : 'info');

    // DEBUG 로그 활성화 여부 (개발 환경에서만 기본 활성화)
    this.enableDebug = process.env.ENABLE_DEBUG_LOGS === 'true' ||
                      (process.env.NODE_ENV === 'development' && process.env.ENABLE_DEBUG_LOGS !== 'false');
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  debug(tag: string, message: string, data?: any) {
    if (!this.enableDebug || !this.shouldLog('debug')) return;

    const emoji = this.getEmoji(tag);
    if (data) {
      console.log(`${emoji} [${tag}] ${message}`, data);
    } else {
      console.log(`${emoji} [${tag}] ${message}`);
    }
  }

  info(tag: string, message: string, data?: any) {
    if (!this.shouldLog('info')) return;

    const emoji = this.getEmoji(tag);
    if (data) {
      console.log(`${emoji} [${tag}] ${message}`, data);
    } else {
      console.log(`${emoji} [${tag}] ${message}`);
    }
  }

  warn(tag: string, message: string, data?: any) {
    if (!this.shouldLog('warn')) return;

    if (data) {
      console.warn(`⚠️ [${tag}] ${message}`, data);
    } else {
      console.warn(`⚠️ [${tag}] ${message}`);
    }
  }

  error(tag: string, message: string, error?: any) {
    if (!this.shouldLog('error')) return;

    if (error) {
      console.error(`❌ [${tag}] ${message}`, error);
    } else {
      console.error(`❌ [${tag}] ${message}`);
    }
  }

  private getEmoji(tag: string): string {
    // 태그별 이모지 매핑
    const emojiMap: Record<string, string> = {
      'AUTH': '🔑',
      'FACILITY-TASKS': '📋',
      'REVENUE': '💰',
      'BUSINESS': '🏢',
      'API': '🔧',
      'SUPABASE': '🗄️',
      'SECURITY': '🛡️',
      'RATE-LIMIT': '⏱️',
      'REALTIME': '📡',
      'NOTIFICATIONS': '🔔',
      'OPTIMISTIC': '⚡'
    };

    for (const [key, emoji] of Object.entries(emojiMap)) {
      if (tag.includes(key)) return emoji;
    }

    return '📝';
  }
}

// 싱글톤 인스턴스 export
export const logger = Logger.getInstance();

// 편의 함수들
export const logDebug = (tag: string, message: string, data?: any) => logger.debug(tag, message, data);
export const logInfo = (tag: string, message: string, data?: any) => logger.info(tag, message, data);
export const logWarn = (tag: string, message: string, data?: any) => logger.warn(tag, message, data);
export const logError = (tag: string, message: string, error?: any) => logger.error(tag, message, error);
