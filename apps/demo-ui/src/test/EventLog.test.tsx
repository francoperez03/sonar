import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

async function loadEventLog() {
  vi.resetModules();
  const storeMod = await import('../state/store.js');
  const ELMod = await import('../components/sidebar/EventLog.js');
  return { store: storeMod.store, EventLog: ELMod.EventLog };
}

describe('EventLog', () => {
  beforeEach(() => {
    cleanup();
    vi.resetModules();
  });

  it('renders empty-state copy when there are no events', async () => {
    const { EventLog } = await loadEventLog();
    render(<EventLog />);
    expect(screen.getByText('Stream armed')).toBeInTheDocument();
    expect(screen.getByText('Rotation events will stream here.')).toBeInTheDocument();
  });

  it('renders a row for a LogEntryMsg pushed via store.receive', async () => {
    const { store, EventLog } = await loadEventLog();
    store.receive({
      type: 'log_entry',
      runtimeId: 'alpha',
      level: 'info',
      message: 'boot complete',
      timestamp: Date.now(),
    });
    render(<EventLog />);
    expect(screen.getByText('boot complete')).toBeInTheDocument();
  });

  it('does NOT render chat-kind content (D-07: chat lives in ChatMirror)', async () => {
    const { store, EventLog } = await loadEventLog();
    // Chat messages are routed to state.chats, never to state.events. The
    // EventLog defensively filters kind==='chat' regardless. Either way, this
    // chat content must not surface in the EventLog tree.
    store.receive({
      type: 'chat',
      role: 'user',
      content: 'secret-chat-payload',
      timestamp: Date.now(),
    });
    render(<EventLog />);
    expect(screen.queryByText('secret-chat-payload')).toBeNull();
  });

  it('renders an accent-styled eyebrow for status milestones (received/deprecated)', async () => {
    const { store, EventLog } = await loadEventLog();
    store.receive({
      type: 'log_entry',
      runtimeId: 'alpha',
      level: 'info',
      message: 'alpha received challenge response',
      timestamp: Date.now(),
    });
    render(<EventLog />);
    const body = screen.getByText('alpha received challenge response');
    const row = body.closest('.event-row');
    const kindCell = row?.querySelector('.event-row-kind');
    expect(kindCell).not.toBeNull();
    expect(kindCell?.className).toMatch(/is-accent/);
  });
});
