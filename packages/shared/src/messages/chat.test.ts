import { describe, it, expect } from 'vitest';
import { ChatMsg } from './chat.js';
import { Message } from './index.js';

describe('ChatMsg schema', () => {
  it('parses a valid user-role chat message', () => {
    const input = {
      type: 'chat' as const,
      role: 'user' as const,
      content: 'Rotate alpha now',
      timestamp: 1_700_000_000_000,
    };
    expect(ChatMsg.parse(input)).toEqual(input);
  });

  it('parses a valid assistant-role chat message', () => {
    const input = {
      type: 'chat' as const,
      role: 'assistant' as const,
      content: 'Rotation complete for alpha.',
      timestamp: 1_700_000_001_000,
    };
    expect(ChatMsg.parse(input)).toEqual(input);
  });

  it('is accepted by the discriminated Message union', () => {
    const input = {
      type: 'chat' as const,
      role: 'user' as const,
      content: 'hello',
      timestamp: 1,
    };
    const parsed = Message.parse(input);
    expect(parsed.type).toBe('chat');
  });

  it('rejects role="system" (only user|assistant allowed)', () => {
    const bad = {
      type: 'chat',
      role: 'system',
      content: 'hello',
      timestamp: 1,
    };
    expect(() => Message.parse(bad)).toThrow();
    expect(() => ChatMsg.parse(bad)).toThrow();
  });

  it('rejects empty content', () => {
    expect(() =>
      ChatMsg.parse({ type: 'chat', role: 'user', content: '', timestamp: 1 }),
    ).toThrow();
  });
});
