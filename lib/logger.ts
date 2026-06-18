/**
 * Minimal structured logger. Emits single-line JSON in production (so log
 * aggregators — Datadog, CloudWatch, Loki — can parse it) and readable text
 * in development. Swap the sink here to wire up Sentry/OpenTelemetry later.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

const isProd = process.env.NODE_ENV === 'production'

function emit(level: Level, msg: string, meta?: Record<string, unknown>) {
  if (isProd) {
    const line = JSON.stringify({ level, msg, ts: new Date().toISOString(), ...meta })
    // eslint-disable-next-line no-console
    ;(level === 'error' ? console.error : console.log)(line)
  } else {
    // eslint-disable-next-line no-console
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    fn(`[${level}] ${msg}`, meta ?? '')
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, err?: unknown, meta?: Record<string, unknown>) =>
    emit('error', msg, {
      ...meta,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    }),
}
