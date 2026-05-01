/**
 * publishChat helper tests (Phase 6 D-07).
 *
 * - Validates ChatMsg locally before fetch (empty content → no fetch)
 * - POSTs ChatMsg to ${operatorUrl}/log/publish with Bearer auth
 * - Never throws on network error (fail-quiet — decorative)
 * - Never throws on non-200 response
 *
 * Stubs globalThis.fetch via vi.fn() — no HTTP-mock dep needed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { publishChat } from '../src/operator/chatPublish.js';

const realFetch = globalThis.fetch;

beforeEach(() => {
  // Default: clean slate per test.
  globalThis.fetch = realFetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe('publishChat (Phase 6 D-07)', () => {
  it('POSTs a valid ChatMsg with Bearer auth to ${operatorUrl}/log/publish', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await publishChat({
      operatorUrl: 'http://op.test:8787',
      webhookSecret: 'secret-xyz',
      role: 'user',
      content: 'Call list_runtimes',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('http://op.test:8787/log/publish');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers.Authorization).toBe('Bearer secret-xyz');

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body['type']).toBe('chat');
    expect(body['role']).toBe('user');
    expect(body['content']).toBe('Call list_runtimes');
    expect(typeof body['timestamp']).toBe('number');
  });

  it('skips fetch when content is empty (zod validation runs before fetch)', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await publishChat({
      operatorUrl: 'http://op.test:8787',
      webhookSecret: 'secret',
      role: 'user',
      content: '',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('skips fetch when webhookSecret is empty (no-secret graceful degradation)', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await publishChat({
      operatorUrl: 'http://op.test:8787',
      webhookSecret: '',
      role: 'assistant',
      content: 'ok',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not throw when fetch rejects (network error)', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await expect(
      publishChat({
        operatorUrl: 'http://op.test:8787',
        webhookSecret: 'secret',
        role: 'user',
        content: 'hello',
      }),
    ).resolves.toBeUndefined();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not throw when response is non-2xx', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await expect(
      publishChat({
        operatorUrl: 'http://op.test:8787',
        webhookSecret: 'wrong',
        role: 'assistant',
        content: 'hi',
      }),
    ).resolves.toBeUndefined();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('emits role=assistant and timestamp is recent (now-ish)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const before = Date.now();
    await publishChat({
      operatorUrl: 'http://op.test:8787',
      webhookSecret: 'secret',
      role: 'assistant',
      content: 'Found 3 runtimes',
    });
    const after = Date.now();

    const init = fetchSpy.mock.calls[0]![1];
    const body = JSON.parse(init.body as string) as { role: string; timestamp: number };
    expect(body.role).toBe('assistant');
    expect(body.timestamp).toBeGreaterThanOrEqual(before);
    expect(body.timestamp).toBeLessThanOrEqual(after);
  });
});
