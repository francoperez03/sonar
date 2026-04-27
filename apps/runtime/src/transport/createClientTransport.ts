import WebSocket from 'ws';
import type { ITransport, Unsubscribe } from '@sonar/shared';
import { Message } from '@sonar/shared';
import { log } from '../util/log.js';

export interface ClientOpts {
  url: string;
  onOpen?: () => void;  // called on every fresh 'open' (including after reconnect) — D-11
  onClose?: (code: number, reason: string) => void;
}

export async function createClientTransport(opts: ClientOpts): Promise<ITransport> {
  let currentWs: WebSocket | null = null;
  const messageHandlers = new Set<(msg: Message) => void>();
  let backoff = 1_000;
  let pingTimeout: ReturnType<typeof setTimeout> | null = null;
  let shuttingDown = false;

  function heartbeat(this: WebSocket) {
    if (pingTimeout) clearTimeout(pingTimeout);
    // 20s + 25s = 45s window per D-11 / RESEARCH Pattern 2 line 317
    pingTimeout = setTimeout(() => {
      log({ msg: 'heartbeat_timeout', level: 'warn' });
      this.terminate(); // Pattern S-7: terminate() not close() in heartbeat path
    }, 45_000);
  }

  function connect() {
    if (shuttingDown) return;
    const ws = new WebSocket(opts.url);
    currentWs = ws;

    ws.on('open', function (this: WebSocket) {
      backoff = 1_000; // reset on successful open
      heartbeat.call(ws);
      opts.onOpen?.();
    });

    ws.on('ping', function () {
      heartbeat.call(ws);
    });

    ws.on('message', (raw) => {
      let msg: Message;
      try {
        msg = Message.parse(JSON.parse(raw.toString()));
      } catch (_e) {
        log({ msg: 'invalid_message', level: 'warn' });
        ws.close(1003, 'invalid_message');
        return;
      }
      messageHandlers.forEach((h) => h(msg));
    });

    ws.on('close', (code, reason) => {
      if (pingTimeout) {
        clearTimeout(pingTimeout);
        pingTimeout = null;
      }
      currentWs = null;
      opts.onClose?.(code, reason.toString());
      scheduleReconnect();
    });

    ws.on('error', (err) => {
      log({ msg: 'ws_error', err: String(err), level: 'warn' });
      // 'close' event follows; no need to reconnect here
    });
  }

  function scheduleReconnect() {
    if (shuttingDown) return;
    setTimeout(() => {
      backoff = Math.min(backoff * 2, 30_000);
      connect();
    }, backoff);
  }

  // Initial connection — wait for 'open' or 'error' before resolving
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(opts.url);
    currentWs = ws;

    const onOpen = function (this: WebSocket) {
      ws.removeListener('error', onError);
      backoff = 1_000;
      heartbeat.call(ws);
      opts.onOpen?.();
      resolve();
    };

    const onError = (err: Error) => {
      ws.removeListener('open', onOpen);
      // Don't reject — the 'close' event will follow and trigger scheduleReconnect
      resolve(); // resolve so the caller can get the transport object
    };

    ws.once('open', onOpen);
    ws.once('error', onError);

    ws.on('ping', function () {
      heartbeat.call(ws);
    });

    ws.on('message', (raw) => {
      let msg: Message;
      try {
        msg = Message.parse(JSON.parse(raw.toString()));
      } catch (_e) {
        log({ msg: 'invalid_message', level: 'warn' });
        ws.close(1003, 'invalid_message');
        return;
      }
      messageHandlers.forEach((h) => h(msg));
    });

    ws.on('close', (code, reason) => {
      if (pingTimeout) {
        clearTimeout(pingTimeout);
        pingTimeout = null;
      }
      currentWs = null;
      opts.onClose?.(code, reason.toString());
      scheduleReconnect();
    });

    ws.on('error', (err) => {
      log({ msg: 'ws_error', err: String(err), level: 'warn' });
    });
  });

  const transport: ITransport = {
    send(msg: Message): Promise<void> {
      return new Promise((resolve, reject) => {
        if (currentWs?.readyState !== WebSocket.OPEN) {
          return reject(new Error('not_connected'));
        }
        currentWs.send(JSON.stringify(msg), (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },

    onMessage(handler: (msg: Message) => void): Unsubscribe {
      messageHandlers.add(handler);
      return () => messageHandlers.delete(handler);
    },

    close(): Promise<void> {
      shuttingDown = true;
      if (pingTimeout) {
        clearTimeout(pingTimeout);
        pingTimeout = null;
      }
      return new Promise((resolve) => {
        if (!currentWs || currentWs.readyState === WebSocket.CLOSED) {
          resolve();
          return;
        }
        currentWs.once('close', () => resolve());
        currentWs.close(1000, 'shutdown');
        currentWs = null;
      });
    },
  };

  return transport;
}
