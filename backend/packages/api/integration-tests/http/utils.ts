import Redis from "ioredis";

// Shared harness policy for the HTTP suites — the two idioms every suite was
// copy-pasting. Not a spec file (jest's http testMatch only picks *.spec.ts).

/**
 * Resolves to the axios response for BOTH 2xx and error statuses — the suites
 * assert on 4xx/429 bodies, so HTTP errors must come back as values, while
 * transport errors (no response at all) still throw.
 *
 * Typed `any` on purpose: the runner's api client is an untyped axios-like,
 * and pinning a response shape here would force every suite to re-assert the
 * fields it reads (status/data/headers vary per assertion).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const unwrapResponse = (promise: Promise<any>): Promise<any> =>
  promise.then(
    (r) => r,
    (e: { response?: unknown }) => {
      if (!e.response) throw e;
      return e.response;
    }
  );

/**
 * Connects to the test Redis or THROWS — deliberately no skip: the rate
 * limiter silently fails over to its in-memory store, so a suite that skipped
 * this probe would stay green even with the Redis path broken. `purpose` says
 * what the suite needs Redis for, verbatim, in the failure message.
 */
export async function connectTestRedisOrFail(purpose: string): Promise<Redis> {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  const redis = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 2_000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  redis.on("error", () => {
    /* assertions surface failures; avoid unhandled 'error' events */
  });
  try {
    await redis.connect();
  } catch (err) {
    throw new Error(
      `Redis unreachable at ${url} — ${purpose}. Start it: docker start pokenic-redis. (${err})`
    );
  }
  return redis;
}
