import type { WebSocketServer, WebSocket } from 'ws';
import { Message } from '@sonar/shared';
import type { ITransport, CreateServerTransport } from '@sonar/shared';
import type { HandshakeCoordinator } from '../handshake/HandshakeCoordinator.js';
import type { LogBus } from '../log/LogBus.js';
import { log } from '../util/log.js';

export interface RuntimeSocketDeps {
  coordinator: HandshakeCoordinator;
  logBus: LogBus;
}

/**
 * Mount the /runtime WebSocketServer with per-socket Message.parse dispatch and heartbeat.
 * Per RESEARCH Patterns 2 + 6; PATTERNS §createServerTransport.
 */
export function mountRuntimeSocket(wss: WebSocketServer, deps: RuntimeSocketDeps): void {
  const { coordinator } = deps;

  function heartbeat(this: WebSocket) {
    (this as unknown as { isAlive: boolean }).isAlive = true;
  }

  wss.on('connection', (ws) => {
    (ws as unknown as { isAlive: boolean }).isAlive = true;
    ws.on('pong', heartbeat);

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = Message.parse(JSON.parse(raw.toString()));
      } catch {
        ws.close(1003, 'invalid_message');
        return;
      }
      switch (msg.type) {
        case 'register':
          return coordinator.onRegister(ws, msg);
        case 'signed_response':
          return coordinator.onSignedResponse(ws, msg);
        case 'ack':
          return coordinator.onAck(ws, msg);
        default:
          ws.close(1003, `unexpected_type:${(msg as { type: string }).type}`);
      }
    });

    ws.on('error', (err) => {
      log({ msg: 'runtime_socket_error', error: String(err) });
    });
  });

  // Heartbeat: ping every 20s; terminate if pong not received (Pattern 2, D-11).
  const pingInterval = setInterval(() => {
    for (const ws of wss.clients) {
      const wsAny = ws as unknown as { isAlive: boolean };
      if (wsAny.isAlive === false) {
        ws.terminate();
        return;
      }
      wsAny.isAlive = false;
      ws.ping();
    }
  }, 20_000);

  wss.on('close', () => clearInterval(pingInterval));
}

/**
 * createServerTransport: single-socket ITransport factory for type-level TRAN-01 proof.
 * Real multi-socket usage goes through mountRuntimeSocket.
 * Exporting this typed factory satisfies CreateServerTransport from @sonar/shared (typecheck proof).
 */
export const createServerTransport: CreateServerTransport = async (_opts): Promise<ITransport> => {
  // This is a type-level proof. Real wiring uses mountRuntimeSocket.
  throw new Error('createServerTransport: use mountRuntimeSocket for multi-socket wiring');
};
