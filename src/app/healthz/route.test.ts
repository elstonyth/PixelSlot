import { describe, expect, test } from 'vitest';

import { GET } from './route';

// The DigitalOcean App Platform health check polls this endpoint instead of `/`
// so every probe is a cheap 200 rather than a full homepage render
// (see .do/storefront.app.yaml -> services[].health_check.http_path).
describe('GET /healthz', () => {
  test('returns 200 with body "ok"', async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });
});
