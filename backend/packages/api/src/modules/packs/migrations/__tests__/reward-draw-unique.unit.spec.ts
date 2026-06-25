import { Migration20260625000100 } from '../Migration20260625000100';

/**
 * Migration guard for the reward_draw partial-unique index — unit (SQL-string inspection).
 *
 * Pattern mirrors hardening-migration.unit.spec.ts: stub addSql, assert the emitted
 * DDL is exactly the partial-unique expression we need.
 *
 * What this verifies:
 *   - up() emits a UNIQUE INDEX on (customer_id, draw_day, draw_ordinal) WHERE deleted_at IS NULL.
 *   - The index name is UQ_reward_draw_customer_day_ordinal.
 *   - down() emits the matching DROP INDEX.
 *
 * DB-level rejection of duplicate (customer_id, draw_day, draw_ordinal) inserts is the
 * corollary: the index definition above is the machine-readable proof. Combined concurrent
 * enforcement (no raw 23505 leaking to callers) is covered by Task B6's concurrency test.
 */

test('Migration20260625000100 emits partial-unique index UQ_reward_draw_customer_day_ordinal', async () => {
  const sql: string[] = [];
  const m = Object.create(
    Migration20260625000100.prototype,
  ) as Migration20260625000100 & { addSql: (s: string) => void };
  m.addSql = (s: string) => sql.push(s);

  await m.up();
  const up = sql.join('\n');

  expect(up).toMatch(/CREATE UNIQUE INDEX/i);
  expect(up).toMatch(/"UQ_reward_draw_customer_day_ordinal"/);
  expect(up).toMatch(/"reward_draw"/);
  expect(up).toMatch(/"customer_id"/);
  expect(up).toMatch(/"draw_day"/);
  expect(up).toMatch(/"draw_ordinal"/);
  expect(up).toMatch(/deleted_at IS NULL/i);

  // down() must drop exactly that index
  sql.length = 0;
  await m.down();
  const down = sql.join('\n');
  expect(down).toMatch(/DROP INDEX/i);
  expect(down).toMatch(/"UQ_reward_draw_customer_day_ordinal"/);
});
