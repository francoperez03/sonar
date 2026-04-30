import type { LogEntryMsg, StatusChangeMsg } from '@sonar/shared';

type Event = LogEntryMsg | StatusChangeMsg;

/**
 * Fixed-capacity in-memory ring buffer for the MCP log stream.
 * Push is O(1); snapshot is O(n) and returns events in chronological order.
 * On overflow the oldest event is overwritten (eviction is implicit).
 */
export class RingBuffer {
  private data: (Event | undefined)[];
  private head = 0;        // next write index
  private size = 0;        // current count, capped at capacity

  constructor(private capacity: number) {
    if (capacity < 1) throw new Error('capacity must be >= 1');
    this.data = new Array(capacity);
  }

  push(e: Event): void {
    this.data[this.head] = e;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) this.size += 1;
  }

  /** Chronological-order snapshot, filtered, then last `limit`. */
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
