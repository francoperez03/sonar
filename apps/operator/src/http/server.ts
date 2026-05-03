import { createServer, type Server } from 'node:http';
import express, { type Express } from 'express';
import { WebSocketServer } from 'ws';
import { jsonBody } from './middleware/json.js';
import { requestLog, bodyParseErrorLog } from './middleware/requestLog.js';
import { bearerAuth } from './middleware/bearerAuth.js';
import { distributeRoute } from './routes/distribute.js';
import { revokeRoute } from './routes/revoke.js';
import { runtimesRoute } from './routes/runtimes.js';
import { rotationGenerateRoute } from './routes/rotation/generate.js';
import { rotationDistributeRoute } from './routes/rotation/distribute.js';
import { rotationCompleteRoute } from './routes/rotation/complete.js';
import { rotationLogIngestRoute } from './routes/rotation/log-ingest.js';
import { logPublishRoute } from './routes/log/publish.js';
import { agentChatRoute } from './routes/agent/chat.js';
import { agentCors } from './middleware/cors.js';
import { mountRuntimeSocket } from '../transport/createServerTransport.js';
import { mountLogSocket } from '../log/logSubscribers.js';
import type { Registry } from '../registry/Registry.js';
import type { ActiveSessions } from '../sessions/ActiveSessions.js';
import type { LogBus } from '../log/LogBus.js';
import type { HandshakeCoordinator } from '../handshake/HandshakeCoordinator.js';
import type { PrivkeyVault } from '../rotation/PrivkeyVault.js';
import type { RingBuffer } from '../log/RingBuffer.js';

export interface OperatorDeps {
  registry: Registry;
  sessions: ActiveSessions;
  logBus: LogBus;
  coordinator: HandshakeCoordinator;
  vault: PrivkeyVault;
  webhookSecret: string;
  buffer: RingBuffer;
  anthropicApiKey: string;
  keeperhub: {
    apiBaseUrl: string;
    apiToken: string;
    workflowId: string;
    pollerBaseUrl: string;
  };
  /** Loopback WS URL — passed to the agent's simulate_clone_attack tool. */
  runtimeWsUrl: string;
}

/**
 * Create the Operator HTTP + WS server.
 * Single HTTP port with two WS endpoints multiplexed via upgrade router (Pattern 1).
 * - POST /distribute  (OPER-03)
 * - POST /revoke      (OPER-04)
 * - GET  /runtimes    (OPER-02)
 * - POST /rotation/generate     (Phase 5 D-07/D-18, bearer-auth)
 * - POST /rotation/distribute   (Phase 5 D-10/D-11/D-12, bearer-auth)
 * - POST /rotation/complete     (Phase 5 D-19, bearer-auth)
 * - POST /rotation/log-ingest   (Phase 5 D-16, bearer-auth)
 * - POST /log/publish           (Phase 6 D-07, bearer-auth — chat events)
 * - WS   /runtime     (TRAN-02)
 * - WS   /logs        (OPER-03 broadcast)
 */
export function createOperatorServer(deps: OperatorDeps): { app: Express; httpServer: Server; wssRuntime: WebSocketServer; wssLogs: WebSocketServer } {
  const app = express();
  app.use(requestLog);
  app.use(jsonBody);

  app.post('/distribute', distributeRoute({ sessions: deps.sessions, coordinator: deps.coordinator }));
  app.post('/revoke', revokeRoute({ coordinator: deps.coordinator }));
  // Browser-readable: GET /runtimes is consumed by demo-ui at boot to hydrate
  // wallet addresses; CORS-locked via the same allowlist as /agent/chat.
  app.options('/runtimes', agentCors);
  app.get('/runtimes', agentCors, runtimesRoute({ registry: deps.registry }));

  // Phase 5 D-18: workflow-facing /rotation/* surface, bearer-auth at every entry.
  const auth = bearerAuth(deps.webhookSecret);
  app.post('/rotation/generate', auth, rotationGenerateRoute({ vault: deps.vault, logBus: deps.logBus }));
  app.post(
    '/rotation/distribute',
    auth,
    rotationDistributeRoute({ vault: deps.vault, coordinator: deps.coordinator, logBus: deps.logBus, sessions: deps.sessions, registry: deps.registry }),
  );
  app.post('/rotation/complete', auth, rotationCompleteRoute({ vault: deps.vault, logBus: deps.logBus }));
  app.post('/rotation/log-ingest', auth, rotationLogIngestRoute({ logBus: deps.logBus }));

  // Phase 6 D-07: chat-event ingestion for the demo-ui ChatMirror. Bearer-auth'd
  // mirror of /rotation/log-ingest's pattern; broadcasts ChatMsg via /logs WS.
  app.post('/log/publish', auth, logPublishRoute({ logBus: deps.logBus }));

  // Phase 7: agent SSE endpoint — browser-callable, CORS-locked to demo-ui.
  app.options('/agent/chat', agentCors);
  app.post(
    '/agent/chat',
    agentCors,
    agentChatRoute({
      apiKey: deps.anthropicApiKey,
      logBus: deps.logBus,
      toolsCtx: {
        registry: deps.registry,
        coordinator: deps.coordinator,
        buffer: deps.buffer,
        logBus: deps.logBus,
        keeperhub: { ...deps.keeperhub, webhookSecret: deps.webhookSecret },
        runtimeWsUrl: deps.runtimeWsUrl,
      },
    }),
  );

  app.use(bodyParseErrorLog);

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
