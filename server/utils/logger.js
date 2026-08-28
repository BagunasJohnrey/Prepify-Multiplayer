import pino from "pino";

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  transport: isProduction ? undefined : {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  },
  formatters: {
    level: (label) => {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'prepify-api',
    environment: process.env.NODE_ENV || 'development'
  }
});

/**
 * Child logger with context
 */
export function createChildLogger(context) {
  return logger.child(context);
}

/**
 * Audit logger for security events
 */
export const auditLogger = logger.child({ category: 'audit' });

/**
 * Log authentication events
 */
export function logAuthEvent(event, details) {
  auditLogger.info({
    event,
    ...details,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log security events (failed auth, suspicious activity, etc.)
 */
export function logSecurityEvent(event, details) {
  auditLogger.warn({
    event,
    ...details,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log API errors
 */
export function logError(err, context = {}) {
  logger.error({
    err: {
      message: err.message,
      stack: err.stack,
      code: err.code,
      statusCode: err.statusCode
    },
    ...context
  });
}

/**
 * Log rate limit hits
 */
export function logRateLimit(identifier, endpoint, details = {}) {
  auditLogger.warn({
    event: 'rate_limit_exceeded',
    identifier,
    endpoint,
    ...details,
    timestamp: new Date().toISOString()
  });
}

export default logger;