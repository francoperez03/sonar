/**
 * config.ts — Phase 5 strict-required env vars (B-02 / D-18).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('getConfig', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    // Reset to a clean Phase-5-aware baseline.
    delete process.env['KEEPERHUB_WEBHOOK_SECRET'];
    delete process.env['KEEPERHUB_API_TOKEN'];
    delete process.env['KEEPERHUB_WORKFLOW_ID'];
    delete process.env['KEEPERHUB_BASE_URL'];
    delete process.env['POLLER_BASE_URL'];
  });
  afterEach(() => {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, saved);
  });

  it('throws when KEEPERHUB_WEBHOOK_SECRET is unset', async () => {
    const mod = await import('../src/config.js');
    expect(() => mod.getConfig()).toThrow(/KEEPERHUB_WEBHOOK_SECRET is required/);
  });

  it('returns defaults for optional Phase 5 vars when secret is set', async () => {
    process.env['KEEPERHUB_WEBHOOK_SECRET'] = 'wh-test';
    const mod = await import('../src/config.js');
    const cfg = mod.getConfig();
    expect(cfg.keeperhubWebhookSecret).toBe('wh-test');
    expect(cfg.keeperhubApiToken).toBe('');
    expect(cfg.keeperhubWorkflowId).toBe('');
    expect(cfg.keeperhubBaseUrl).toBe('https://app.keeperhub.com');
    expect(cfg.pollerBaseUrl).toBe('http://localhost:8788');
  });

  it('reads Phase 5 env values when provided', async () => {
    process.env['KEEPERHUB_WEBHOOK_SECRET'] = 's';
    process.env['KEEPERHUB_API_TOKEN'] = 'tok';
    process.env['KEEPERHUB_WORKFLOW_ID'] = 'wf_42';
    process.env['KEEPERHUB_BASE_URL'] = 'https://example.test';
    process.env['POLLER_BASE_URL'] = 'http://127.0.0.1:9999';
    const mod = await import('../src/config.js');
    const cfg = mod.getConfig();
    expect(cfg.keeperhubApiToken).toBe('tok');
    expect(cfg.keeperhubWorkflowId).toBe('wf_42');
    expect(cfg.keeperhubBaseUrl).toBe('https://example.test');
    expect(cfg.pollerBaseUrl).toBe('http://127.0.0.1:9999');
  });
});
