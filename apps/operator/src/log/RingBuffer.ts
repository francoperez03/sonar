import type { LogEntryMsg, StatusChangeMsg } from '@sonar/shared';

type Event = LogEntryMsg | StatusChangeMsg;

/**
 * Fixed-capacity ring buffer mirroring apps/mcp/src/buffer/RingBuffer.ts.
 * Wired to LogBus at server boot so the agent's get_workflow_log tool can
 * read recent operator events in-process.
 */
export class RingBuffer {
  private data: (Event | undefined)[];
  private head = 0;
  private size = 0;

  constructor(private capacity: number) {
    if (capacity < 1) throw new Error('capacity must be >= 1');
    this.data = new Array(capacity);
  }

  push(e: Event): void {
    this.data[this.head] = e;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) this.size += 1;
  }

  /** Phase 7 reset_demo helper: drop all retained events. */
  clear(): void {
    this.data = new Array(this.capacity);
    this.head = 0;
    this.size = 0;
  }

  snapshot(filter?: { runtimeId?: string }, limit = 50): Event[] {
    const out: Event[] = [];
    const start = this.size < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.size; i++) {
      const ev = this.data[(start + i) % this.capacity]!;
      if (!filter?.runtimeId || ev.runtimeId === filter.runtimeId) out.push(ev);
    }
    const clamped = Math.max(1, Math.min(limit, this.capacity));
    return out.slice(-clamped);
  }
}
