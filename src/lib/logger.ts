/**
 * Minimal server-side logging seam.
 *
 * Wraps `console` so call sites don't scatter raw `console.*` and a real
 * structured logger (pino/winston) can be swapped in one place later. Use for
 * genuine error/warn surfacing on the server (data-seam fetch failures, etc.) —
 * not for debug tracing.
 */
type LogFn = (message: string, ...meta: unknown[]) => void;

export const logger: { warn: LogFn; error: LogFn } = {
  warn: (message, ...meta) => console.warn(message, ...meta),
  error: (message, ...meta) => console.error(message, ...meta),
};
