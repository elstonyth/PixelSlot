# Testing Requirements

> **This repo (Pokenic_Game / phygitals clone):** this is a pixel-perfect
> *visual* clone, not a logic-heavy app. The primary quality signal is
> **Playwright visual regression** (the `scripts/*.mjs` capture/measure/QA
> scripts), not unit coverage. Apply the coverage target below to genuine logic —
> `src/lib/*` utilities and `src/hooks/*` — and to the Medusa backend. Do **not**
> chase 80% by writing brittle markup assertions for presentational components;
> see [web/testing.md](../web/testing.md) for the visual-first priority order.

## Test Coverage Target: 80% (of testable logic)

Scope the 80% to units that encode behavior (utilities, hooks, data transforms,
backend endpoints). Presentational/visual components are covered by visual
regression instead.

Test Types:
1. **Unit Tests** - Individual functions, utilities, hooks, components with logic
2. **Integration Tests** - API endpoints, database operations (backend)
3. **E2E / Visual** - Critical user flows and visual regression (Playwright)

## Test-Driven Development

Default workflow for new **logic** (utilities, hooks, backend):
1. Write test first (RED)
2. Run test - it should FAIL
3. Write minimal implementation (GREEN)
4. Run test - it should PASS
5. Refactor (IMPROVE)
6. Verify coverage (80%+ of the logic added)

For visual/presentational work, lead with the Playwright capture/compare loop
instead of TDD.

## Troubleshooting Test Failures

1. Check test isolation
2. Verify mocks are correct
3. Fix implementation, not tests (unless tests are wrong)

## Test Structure (AAA Pattern)

Prefer Arrange-Act-Assert structure for tests:

```typescript
test('calculates similarity correctly', () => {
  // Arrange
  const vector1 = [1, 0, 0]
  const vector2 = [0, 1, 0]

  // Act
  const similarity = calculateCosineSimilarity(vector1, vector2)

  // Assert
  expect(similarity).toBe(0)
})
```

### Test Naming

Use descriptive names that explain the behavior under test:

```typescript
test('returns empty array when no markets match query', () => {})
test('throws error when API key is missing', () => {})
test('falls back to substring search when Redis is unavailable', () => {})
```
