import { createServer } from 'node:http';
import express from 'express';
import { WebSocketServer } from 'ws';
import { jsonBody } from './middleware/json.js';
import { distributeRoute } from './routes/distribute.js';
import { revokeRoute } from './routes/revoke.js';
import { runtimesRoute } from './routes/runtimes.js';
import { mountRuntimeSocket } from '../transport/createServerTransport.js';
import { mountLogSocket } from '../log/logSubscribers.js';
import type { Registry } from '../registry/Registry.js';
import type { ActiveSessions } from '../sessions/ActiveSessions.js';
import type { LogBus } from '../log/LogBus.js';
import type { HandshakeCoordinator } from '../handshake/HandshakeCoordinator.js';

export interface OperatorDeps {
  registry: Registry;
  sessions: ActiveSessions;
  logBus: LogBus;
  coordinator: HandshakeCoordinator;
}

/**
 * Create the Operator HTTP + WS server.
 * Single HTTP port with two WS endpoints multiplexed via upgrade router (Pattern 1).
 * - POST /distribute  (OPER-03)
 * - POST /revoke      (OPER-04)
 * - GET  /runtimes    (OPER-02)
 * - WS   /runtime     (TRAN-02)
 * - WS   /logs        (OPER-03 broadcast)
 */
export function createOperatorServer(deps: OperatorDeps) {
  const app = express();
  app.use(jsonBody);

  app.post('/distribute', distributeRoute({ sessions: deps.sessions, coordinator: deps.coordinator }));
  app.post('/revoke', revokeRoute({ coordinator: deps.coordinator }));
  app.get('/runtimes', runtimesRoute({ registry: deps.registry }));

  const httpServer = createServer(app);

  // Two separate WebSocketServer instances — one per pathname (Pattern 1, Anti-Pattern: never share)
  const wssRuntime = new WebSocketServer({ noServer: true });
  const wssLogs = new WebSocketServer({ noServer: true });

  mountRuntimeSocket(wssRuntime, { coordinator: deps.coordinator, logBus: deps.logBus });
  mountLogSocket(wssLogs, { logBus: deps.logBus });

  httpServer.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url ?? '', 'ws://localhost');
    if (pathname === '/runtime') {
      wssRuntime.handleUpgrade(req, socket, head, (ws) => wssRuntime.emit('connection', ws, req));
      return;
    }
    if (pathname === '/logs') {
      wssLogs.handleUpgrade(req, socket, head, (ws) => wssLogs.emit('connection', ws, req));
      return;
    }
    socket.destroy();
  });

  return { app, httpServer, wssRuntime, wssLogs };
}
