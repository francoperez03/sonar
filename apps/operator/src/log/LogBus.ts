import { EventEmitter } from 'node:events';
import type { LogEntryMsg, StatusChangeMsg, ChatMsg } from '@sonar/shared';

type Event = LogEntryMsg | StatusChangeMsg | ChatMsg;

/**
 * EventEmitter-backed fan-out for LogEntryMsg | StatusChangeMsg | ChatMsg.
 * subscribe(handler) returns an unsubscribe function.
 *
 * Phase 6 D-07/D-09: ChatMsg widening — chat events come fully formed from
 * MCP via POST /log/publish (zod-validated at the boundary). No convenience
 * helper here; callers construct the ChatMsg themselves.
 */
export class LogBus extends EventEmitter {
  emitEvent(e: Event): void {
    this.emit('event', e);
  }

  subscribe(handler: (e: Event) => void): () => void {
    this.on('event', handler);
    return () => this.off('event', handler);
  }

  /** Convenience: emit a log_entry with timestamp filled. */
  logEntry(
    runtimeId: string,
    level: LogEntryMsg['level'],
    message: string,
  ): void {
    this.emitEvent({ type: 'log_entry', runtimeId, level, message, timestamp: Date.now() });
  }

  /** Convenience: emit a status_change with timestamp filled. */
  statusChange(runtimeId: string, status: StatusChangeMsg['status']): void {
    this.emitEvent({ type: 'status_change', runtimeId, status, timestamp: Date.now() });
  }
}
