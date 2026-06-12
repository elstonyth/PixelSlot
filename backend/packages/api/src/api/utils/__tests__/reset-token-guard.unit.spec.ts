import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import {
  InMemoryUsedTokenStore,
  FailoverUsedTokenStore,
  createResetTokenGuardMiddleware,
  type UsedTokenStore,
} from "../reset-token-guard";

const T0 = 1_700_000_000_000; // fixed epoch-ms base so tests are deterministic
const TTL = 900_000;

describe("InMemoryUsedTokenStore", () => {
  it("reports a never-marked key as unused", async () => {
    const store = new InMemoryUsedTokenStore();
    expect(await store.isUsed("k1", T0)).toBe(false);
  });

  it("reports a marked key as used within its TTL", async () => {
    const store = new InMemoryUsedTokenStore();
    await store.markUsed("k1", T0, TTL);
    expect(await store.isUsed("k1", T0 + TTL - 1)).toBe(true);
  });

  it("expires a marked key once its TTL elapses (strict boundary)", async () => {
    const store = new InMemoryUsedTokenStore();
    await store.markUsed("k1", T0, TTL);
    expect(await store.isUsed("k1", T0 + TTL)).toBe(false);
  });

  it("tracks keys independently", async () => {
    const store = new InMemoryUsedTokenStore();
    await store.markUsed("k1", T0, TTL);
    expect(await store.isUsed("k2", T0)).toBe(false);
  });

  it("evicts the oldest key once the cap is reached", async () => {
    const store = new InMemoryUsedTokenStore({ maxKeys: 2 });
    await store.markUsed("k1", T0, TTL);
    await store.markUsed("k2", T0, TTL);
    await store.markUsed("k3", T0, TTL);
    expect(await store.isUsed("k1", T0 + 1)).toBe(false); // evicted
    expect(await store.isUsed("k2", T0 + 1)).toBe(true);
    expect(await store.isUsed("k3", T0 + 1)).toBe(true);
  });
});

describe("FailoverUsedTokenStore", () => {
  const broken: UsedTokenStore = {
    isUsed: async () => {
      throw new Error("redis down");
    },
    markUsed: async () => {
      throw new Error("redis down");
    },
  };

  it("serves reads from the fallback when the primary throws", async () => {
    const fallback = new InMemoryUsedTokenStore();
    await fallback.markUsed("k1", T0, TTL);
    const errors: unknown[] = [];
    const store = new FailoverUsedTokenStore(broken, fallback, (e) =>
      errors.push(e),
    );
    expect(await store.isUsed("k1", T0 + 1)).toBe(true);
    expect(errors).toHaveLength(1);
  });

  it("writes to the fallback when the primary throws", async () => {
    const fallback = new InMemoryUsedTokenStore();
    const store = new FailoverUsedTokenStore(broken, fallback);
    await store.markUsed("k1", T0, TTL);
    expect(await fallback.isUsed("k1", T0 + 1)).toBe(true);
  });

  it("prefers the primary when it is healthy", async () => {
    const primary = new InMemoryUsedTokenStore();
    const fallback = new InMemoryUsedTokenStore();
    const store = new FailoverUsedTokenStore(primary, fallback);
    await store.markUsed("k1", T0, TTL);
    expect(await primary.isUsed("k1", T0 + 1)).toBe(true);
    expect(await fallback.isUsed("k1", T0 + 1)).toBe(false);
  });

  it("still sees a marker stranded in the fallback after the primary recovers", async () => {
    // A Redis blip at consume time strands the marker in memory; once Redis
    // reconnects, a primary-only read would miss it and let the token replay.
    const primary = new InMemoryUsedTokenStore(); // healthy and EMPTY
    const fallback = new InMemoryUsedTokenStore();
    await fallback.markUsed("k1", T0, TTL); // written during the outage
    const store = new FailoverUsedTokenStore(primary, fallback);
    expect(await store.isUsed("k1", T0 + 1)).toBe(true);
  });
});

describe("createResetTokenGuardMiddleware", () => {
  // Minimal express-ish fakes: the middleware only touches
  // req.headers.authorization and res.statusCode / res.on("finish").
  function makeReq(authorization?: string): MedusaRequest {
    return { headers: { authorization } } as unknown as MedusaRequest;
  }

  function makeRes(statusCode: number) {
    const handlers: Array<() => void> = [];
    const res = {
      statusCode,
      on: (event: string, cb: () => void) => {
        if (event === "finish") handlers.push(cb);
      },
    } as unknown as MedusaResponse;
    return { res, finish: () => handlers.forEach((h) => h()) };
  }

  function run(
    store: UsedTokenStore,
    authorization?: string,
    statusCode = 200,
  ) {
    const mw = createResetTokenGuardMiddleware({ store });
    const nextArgs: unknown[][] = [];
    const next: MedusaNextFunction = (...args: unknown[]) => {
      nextArgs.push(args);
    };
    const { res, finish } = makeRes(statusCode);
    return {
      exec: async () => mw(makeReq(authorization), res, next),
      finish,
      nextArgs,
    };
  }

  it("passes through without touching the store when there is no bearer token", async () => {
    const isUsed = jest.fn();
    const store: UsedTokenStore = { isUsed, markUsed: jest.fn() };
    const { exec, nextArgs } = run(store, undefined);
    await exec();
    expect(nextArgs).toEqual([[]]);
    expect(isUsed).not.toHaveBeenCalled();
  });

  it("lets a fresh token through and marks it used after a 2xx response", async () => {
    const store = new InMemoryUsedTokenStore();
    const { exec, finish, nextArgs } = run(store, "Bearer tok-1", 200);
    await exec();
    expect(nextArgs).toEqual([[]]);
    finish();
    // Second use of the same token must now be rejected.
    const second = run(store, "Bearer tok-1");
    await second.exec();
    expect(second.nextArgs).toHaveLength(1);
    const err = second.nextArgs[0][0] as MedusaError;
    expect(err).toBeInstanceOf(MedusaError);
    expect(err.type).toBe(MedusaError.Types.UNAUTHORIZED);
    // Same message as core's validateToken — no oracle distinguishing
    // "used" from "invalid".
    expect(err.message).toBe("Invalid token");
  });

  it("does not consume the token when the handler fails (non-2xx)", async () => {
    const store = new InMemoryUsedTokenStore();
    const first = run(store, "Bearer tok-1", 401);
    await first.exec();
    first.finish();
    const second = run(store, "Bearer tok-1");
    await second.exec();
    expect(second.nextArgs).toEqual([[]]); // still allowed
  });

  it("rejects a consumed token even with whitespace-padded headers", async () => {
    // Core's parser (/(\S+)\s+(\S+)/, unanchored) accepts headers with
    // leading/trailing whitespace — the guard must hash the same token core
    // validates, or padding becomes a single-use bypass.
    const store = new InMemoryUsedTokenStore();
    const first = run(store, "Bearer tok-1", 200);
    await first.exec();
    first.finish();
    for (const header of ["Bearer tok-1 ", "  Bearer tok-1", "bearer  tok-1"]) {
      const replay = run(store, header);
      await replay.exec();
      expect(replay.nextArgs).toHaveLength(1);
      const err = replay.nextArgs[0][0] as MedusaError;
      expect(err).toBeInstanceOf(MedusaError);
      expect(err.type).toBe(MedusaError.Types.UNAUTHORIZED);
    }
  });

  it("ignores non-bearer authorization schemes", async () => {
    const isUsed = jest.fn();
    const store: UsedTokenStore = { isUsed, markUsed: jest.fn() };
    const { exec, nextArgs } = run(store, "Basic dXNlcjpwYXNz");
    await exec();
    expect(nextArgs).toEqual([[]]);
    expect(isUsed).not.toHaveBeenCalled();
  });

  it("treats different tokens independently", async () => {
    const store = new InMemoryUsedTokenStore();
    const first = run(store, "Bearer tok-1", 200);
    await first.exec();
    first.finish();
    const other = run(store, "Bearer tok-2");
    await other.exec();
    expect(other.nextArgs).toEqual([[]]);
  });

  it("fails open when the store itself throws", async () => {
    const store: UsedTokenStore = {
      isUsed: async () => {
        throw new Error("store bug");
      },
      markUsed: jest.fn(),
    };
    const errors: unknown[] = [];
    const mw = createResetTokenGuardMiddleware({
      store,
      onError: (e) => errors.push(e),
    });
    const nextArgs: unknown[][] = [];
    const { res } = makeRes(200);
    await mw(makeReq("Bearer tok-1"), res, ((...args: unknown[]) => {
      nextArgs.push(args);
    }) as MedusaNextFunction);
    expect(nextArgs).toEqual([[]]); // request allowed through
    expect(errors).toHaveLength(1);
  });
});
