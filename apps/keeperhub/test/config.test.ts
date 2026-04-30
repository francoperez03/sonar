import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('getConfig', () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {
      KEEPERHUB_API_TOKEN: process.env['KEEPERHUB_API_TOKEN'],
      KEEPERHUB_BASE_URL: process.env['KEEPERHUB_BASE_URL'],
      KEEPERHUB_WORKFLOW_ID: process.env['KEEPERHUB_WORKFLOW_ID'],
      OPERATOR_BASE_URL: process.env['OPERATOR_BASE_URL'],
      KEEPERHUB_WEBHOOK_SECRET: process.env['KEEPERHUB_WEBHOOK_SECRET'],
      POLL_INTERVAL_MS: process.env['POLL_INTERVAL_MS'],
    };
    for (const k of Object.keys(saved)) delete process.env[k];
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('throws when KEEPERHUB_API_TOKEN is unset', async () => {
    const { getConfig } = await import('../src/config.js');
    expect(() => getConfig()).toThrow(/KEEPERHUB_API_TOKEN required/);
  });

  it('throws when KEEPERHUB_WEBHOOK_SECRET is unset', async () => {
    process.env['KEEPERHUB_API_TOKEN'] = 'tok';
    const { getConfig } = await import('../src/config.js');
    expect(() => getConfig()).toThrow(/KEEPERHUB_WEBHOOK_SECRET is required/);
  });

  it('returns parsed values with defaults for missing optional vars', async () => {
    process.env['KEEPERHUB_API_TOKEN'] = 'tok';
    process.env['KEEPERHUB_WEBHOOK_SECRET'] = 'whsec';
    const { getConfig } = await import('../src/config.js');
    const cfg = getConfig();
    expect(cfg.apiToken).toBe('tok');
    expect(cfg.webhookSecret).toBe('whsec');
    expect(cfg.apiBaseUrl).toBe('https://app.keeperhub.com');
    expect(cfg.operatorBaseUrl).toBe('http://localhost:8787');
    expect(cfg.workflowId).toBeUndefined();
    expect(cfg.pollIntervalMs).toBe(3000);
  });

  it('parses POLL_INTERVAL_MS as numeric', async () => {
    process.env['KEEPERHUB_API_TOKEN'] = 'tok';
    process.env['KEEPERHUB_WEBHOOK_SECRET'] = 'whsec';
    process.env['POLL_INTERVAL_MS'] = '5000';
    const { getConfig } = await import('../src/config.js');
    const cfg = getConfig();
    expect(cfg.pollIntervalMs).toBe(5000);
  });
});
