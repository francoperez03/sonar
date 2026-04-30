/**
 * get_workflow_log tool unit tests (MCP-01).
 */
import { describe, it, expect } from 'vitest';
import { RingBuffer } from '../src/buffer/RingBuffer.js';
import { buildMcpServer } from '../src/mcpServer.js';
import type { LogEntryMsg, StatusChangeMsg } from '@sonar/shared';

function entry(runtimeId: string, message: string, ts: number): LogEntryMsg {
  return { type: 'log_entry', runtimeId, level: 'info', message, timestamp: ts };
}

function status(runtimeId: string, s: StatusChangeMsg['status'], ts: number): StatusChangeMsg {
  return { type: 'status_change', runtimeId, status: s, timestamp: ts };
}

function getTool(server: any, name: string) {
  const tool = server._registeredTools?.[name];
  if (!tool) throw new Error(`tool not found: ${name}`);
  return tool;
}

async function invoke(server: any, name: string, args: unknown) {
  const tool = getTool(server, name);
  return await tool.handler(args, {} as any);
}

describe('get_workflow_log tool (MCP-01)', () => {
  it('registers get_workflow_log with { limit?, runtimeId? } inputSchema and events output', async () => {
    const buffer = new RingBuffer(50);
    buffer.push(entry('alpha', 'first', 1));
    buffer.push(status('beta', 'registered', 2));

    const server = buildMcpServer({ buffer, operatorHttpUrl: 'http://localhost:8787' });
    const tool = getTool(server, 'get_workflow_log');
    expect(tool).toBeTruthy();

    const r = await invoke(server, 'get_workflow_log', {});
    expect(r.structuredContent.events).toHaveLength(2);
    expect(r.structuredContent.events[0]).toMatchObject({ type: 'log_entry', runtimeId: 'alpha' });
    expect(r.structuredContent.events[1]).toMatchObject({ type: 'status_change', runtimeId: 'beta' });
  });

  it('defaults limit to 50 when omitted (RingBuffer.snapshot semantics)', async () => {
    const buffer = new RingBuffer(200);
    for (let i = 0; i < 120; i++) buffer.push(entry('alpha', `m${i}`, i));

    const server = buildMcpServer({ buffer, operatorHttpUrl: 'http://localhost:8787' });
    const r = await invoke(server, 'get_workflow_log', {}); // omit limit
    expect(r.structuredContent.events).toHaveLength(50);
    // Default takes the LAST 50 — chronologically m70..m119.
    expect(r.structuredContent.events[0].message).toBe('m70');
    expect(r.structuredContent.events[49].message).toBe('m119');
  });

  it('filters by runtimeId before applying limit', async () => {
    const buffer = new RingBuffer(50);
    buffer.push(entry('alpha', 'a1', 1));
    buffer.push(entry('beta', 'b1', 2));
    buffer.push(entry('alpha', 'a2', 3));
    buffer.push(entry('gamma', 'g1', 4));

    const server = buildMcpServer({ buffer, operatorHttpUrl: 'http://localhost:8787' });

    const r = await invoke(server, 'get_workflow_log', { runtimeId: 'alpha', limit: 50 });
    expect(r.structuredContent.events).toHaveLength(2);
    expect(r.structuredContent.events.every((e: any) => e.runtimeId === 'alpha')).toBe(true);

    const empty = await invoke(server, 'get_workflow_log', { runtimeId: 'delta' });
    expect(empty.structuredContent.events).toHaveLength(0);
  });
});
