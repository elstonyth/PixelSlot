import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { createHash } from "node:crypto";
import Redis from "ioredis";

// Single-use guard for the password-reset token on
// POST /auth/:actor_type/emailpass/update.
//
// Core Medusa validates the reset token's signature/expiry (15m JWT) but does
// NOT invalidate it after a successful password change — within its lifetime
// the same emailed link could reset the password again (e.g. replayed from a
// mailbox someone else later reads). This middleware closes that: after the
// update handler responds 2xx the token's hash is marked consumed (Redis via
// REDIS_URL, in-memory failover — same semantics as rate-limit.ts), and any
// later request bearing it is rejected with the exact same "Invalid token"
// 401 core emits, so a caller can't distinguish "consumed" from "garbage".
//
// The guard only ever REJECTS; it never authenticates. A token it lets
// through still has to pass core's validateToken (signature + identity), so
// failing open on store errors is safe — it just degrades back to stock
// Medusa behavior.

export interface UsedTokenStore {
  isUsed(key: string, nowMs: number): Promise<boolean>;
  markUsed(key: string, nowMs: number, ttlMs: number): Promise<void>;
}

/**
 * Per-process fallback store. Bounded like the rate limiter's: expired keys
 * are pruned on every touch and the key count is capped (oldest-inserted
 * evicted first — cheap and good enough for a fallback).
 */
export class InMemoryUsedTokenStore implements UsedTokenStore {
  private readonly expiries = new Map<string, number>();
  private readonly maxKeys: number;

  constructor(opts: { maxKeys?: number } = {}) {
    this.maxKeys = opts.maxKeys ?? 10_000;
  }

  async isUsed(key: string, nowMs: number): Promise<boolean> {
    const expiry = this.expiries.get(key);
    if (expiry === undefined) return false;
    if (expiry <= nowMs) {
      this.expiries.delete(key);
      return false;
    }
    return true;
  }

  async markUsed(key: string, nowMs: number, ttlMs: number): Promise<void> {
    if (!this.expiries.has(key) && this.expiries.size >= this.maxKeys) {
      const oldest = this.expiries.keys().next().value;
      if (oldest !== undefined) this.expiries.delete(oldest);
    }
    this.expiries.set(key, nowMs + ttlMs);
  }
}

/**
 * Redis store: one volatile string key per consumed token hash. Expiry is
 * delegated to Redis (PX on write), so the interface's nowMs goes unused
 * here — only the in-memory store needs a clock.
 */
export class RedisUsedTokenStore implements UsedTokenStore {
  constructor(private readonly client: Redis) {}

  async isUsed(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async markUsed(key: string, _nowMs: number, ttlMs: number): Promise<void> {
    await this.client.set(key, "1", "PX", ttlMs);
  }
}

/**
 * Writes go to the primary (fallback on error); reads are the UNION of both.
 * The union matters: a Redis blip at consume time strands the marker in the
 * in-memory fallback, and once Redis reconnects a primary-only read would
 * miss it — replaying the token for the rest of its 15m. Union reads can
 * never 401 a fresh token, because markUsed is the only writer to either
 * store (a fallback hit is always a genuinely consumed token).
 */
export class FailoverUsedTokenStore implements UsedTokenStore {
  constructor(
    private readonly primary: UsedTokenStore,
    private readonly fallback: UsedTokenStore,
    private readonly onError?: (err: unknown) => void,
  ) {}

  async isUsed(key: string, nowMs: number): Promise<boolean> {
    try {
      if (await this.primary.isUsed(key, nowMs)) return true;
    } catch (err) {
      this.onError?.(err);
    }
    return this.fallback.isUsed(key, nowMs);
  }

  async markUsed(key: string, nowMs: number, ttlMs: number): Promise<void> {
    try {
      await this.primary.markUsed(key, nowMs, ttlMs);
    } catch (err) {
      this.onError?.(err);
      await this.fallback.markUsed(key, nowMs, ttlMs);
    }
  }
}

// Reset tokens are minted with expiresIn "15m" (hardcoded in core-flows'
// generateResetPasswordTokenWorkflow); after that the JWT itself is rejected,
// so the consumed marker never needs to outlive it.
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

const KEY_PREFIX = "reset-token:used:";

type MiddlewareHandler = (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) => Promise<void>;

export interface ResetTokenGuardOptions {
  store: UsedTokenStore;
  ttlMs?: number;
  onError?: (err: unknown) => void;
}

export function createResetTokenGuardMiddleware(
  opts: ResetTokenGuardOptions,
): MiddlewareHandler {
  const { store, onError } = opts;
  const ttlMs = opts.ttlMs ?? RESET_TOKEN_TTL_MS;
  return async (req, res, next) => {
    // Parse EXACTLY like core's getAuthContextFromJwtToken (unanchored
    // /(\S+)\s+(\S+)/, token = second group, scheme case-insensitive) — a
    // stricter parser here would let a header core still accepts (e.g.
    // trailing whitespace) skip the guard and replay a consumed token. Keep
    // this in lockstep with @medusajs/framework authenticate-middleware.
    const match = /(\S+)\s+(\S+)/.exec(req.headers.authorization ?? "");
    if (!match || match[1].toLowerCase() !== "bearer") {
      // No bearer token: core's validateToken 401s; nothing for the guard
      // to do.
      next();
      return;
    }
    // Key on the hash, not the token — the store must never hold a credential
    // that is still valid for up to 15 minutes.
    const key =
      KEY_PREFIX + createHash("sha256").update(match[2]).digest("hex");
    let used: boolean;
    try {
      used = await store.isUsed(key, Date.now());
    } catch (err) {
      // A guard bug must not take password reset down; core still fully
      // validates the token, so failing open is stock-Medusa behavior.
      onError?.(err);
      next();
      return;
    }
    if (used) {
      next(new MedusaError(MedusaError.Types.UNAUTHORIZED, "Invalid token"));
      return;
    }
    // Consume only after the handler actually changed the password — a 401
    // (bad signature) or 400 must not burn the user's one valid link.
    // Accepted edge: an aborted connection emits 'close' without 'finish',
    // so a change committed mid-flush escapes consumption — but the token
    // holder just set the password, so a replay gains them nothing.
    res.on("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        store.markUsed(key, Date.now(), ttlMs).catch((err) => onError?.(err));
      }
    });
    next();
  };
}

// Logs at most once per interval so a dead Redis doesn't flood the logs at
// request rate (mirrors rate-limit.ts).
function throttledWarn(
  intervalMs: number,
): (msg: string, err?: unknown) => void {
  let last = 0;
  return (msg, err) => {
    const now = Date.now();
    if (now - last < intervalMs) return;
    last = now;
    const detail = err instanceof Error ? err.message : err;
    console.warn(`[reset-token-guard] ${msg}`, detail ?? "");
  };
}

/**
 * The wired guard for middlewares.ts: Redis-backed (REDIS_URL) with
 * in-memory failover, same fail-fast connection settings as the rate
 * limiters.
 */
export function createResetTokenSingleUseGuard(): MiddlewareHandler {
  const warn = throttledWarn(60_000);
  const memory = new InMemoryUsedTokenStore();

  const redisUrl = process.env.REDIS_URL;
  let store: UsedTokenStore = memory;
  if (!redisUrl) {
    console.warn(
      "[reset-token-guard] REDIS_URL not set — consumed reset tokens are tracked per-process (in-memory) only",
    );
  } else {
    const client = new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      commandTimeout: 500,
      connectionName: "reset-token-guard",
    });
    client.on("error", (err) => warn("redis connection error", err));
    client.connect().catch((err) => warn("initial redis connect failed", err));
    store = new FailoverUsedTokenStore(
      new RedisUsedTokenStore(client),
      memory,
      (err) => warn("redis op failed; using in-memory fallback", err),
    );
  }

  return createResetTokenGuardMiddleware({
    store,
    onError: (err) => warn("guard error; request allowed through", err),
  });
}
