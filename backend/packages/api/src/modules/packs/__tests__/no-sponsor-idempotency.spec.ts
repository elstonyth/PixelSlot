// src/modules/packs/__tests__/no-sponsor-idempotency.spec.ts
// Unit-level test (runs via test:integration:modules) — validates Phase 3b Task 1:
//   1. The migration emits the correct partial-unique index SQL.
//   2. The full end-to-end behavioral test (replay throws, balance correct, reversal
//      coexists) lives in integration-tests/http/no-sponsor-idempotency.spec.ts
//      (runs via test:integration:http, needs the full Medusa stack + real DB).
//
// Note: moduleIntegrationTestRunner is intentionally NOT used here. It has
// unresolvable "Duplicate entity names" issues in this codebase because @Entity()
// decorators pre-populate MetadataStorage when service.ts is imported, before
// MikroORM.init() in setupDatabase() runs. All real DB integration tests use
// medusaIntegrationTestRunner (integration-tests/http/).
import { Migration20260623100000 } from '../migrations/Migration20260623100000';

describe('Migration20260623100000 — no-sponsor debit idempotency index', () => {
  it('emits the partial-unique index on credit_transaction (amount<0 debit-only)', async () => {
    const sql: string[] = [];
    const m = Object.create(
      Migration20260623100000.prototype,
    ) as Migration20260623100000 & { addSql: (s: string) => void };
    m.addSql = (s: string) => sql.push(s);
    await m.up();
    const joined = sql.join('\n');

    // Partial index name
    expect(joined).toMatch(/UQ_credit_txn_pack_open_debit_open_id/);
    // On credit_transaction, keyed by source_transaction_id
    expect(joined).toMatch(/on "credit_transaction" \("source_transaction_id"\)/);
    // Partial predicate: reason='pack_open', amount<0, not deleted
    expect(joined).toMatch(/reason = 'pack_open' and amount < 0 and deleted_at is null/);
  });

  it('down() drops the index', async () => {
    const sql: string[] = [];
    const m = Object.create(
      Migration20260623100000.prototype,
    ) as Migration20260623100000 & { addSql: (s: string) => void };
    m.addSql = (s: string) => sql.push(s);
    await m.down();
    const joined = sql.join('\n');

    expect(joined).toMatch(/drop index if exists "UQ_credit_txn_pack_open_debit_open_id"/);
  });
});
