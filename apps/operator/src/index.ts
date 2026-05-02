import 'dotenv/config';
import { getConfig } from './config.js';
import { Registry } from './registry/Registry.js';
import { ActiveSessions } from './sessions/ActiveSessions.js';
import { LogBus } from './log/LogBus.js';
import { RingBuffer } from './log/RingBuffer.js';
import { HandshakeCoordinator } from './handshake/HandshakeCoordinator.js';
import * as nonces from './handshake/nonces.js';
import { createOperatorServer } from './http/server.js';
import { PrivkeyVault } from './rotation/PrivkeyVault.js';
import { log } from './util/log.js';

// Top-level await: ESM + Node 20+ (D-14)
const cfg = getConfig();
const registry = await Registry.load(cfg.registryPath);
const sessions = new ActiveSessions();
const logBus = new LogBus();
const buffer = new RingBuffer(cfg.logBufferSize);
logBus.subscribe((e) => {
  if (e.type === 'log_entry' || e.type === 'status_change') buffer.push(e);
});
const coordinator = new HandshakeCoordinator({ registry, sessions, logBus, nonceStore: nonces });
const vault = new PrivkeyVault(); // Phase 5 D-19/D-21: in-memory ephemeral wallets
const { httpServer } = createOperatorServer({
  registry,
  sessions,
  logBus,
  coordinator,
  vault,
  webhookSecret: cfg.keeperhubWebhookSecret,
  buffer,
  anthropicApiKey: cfg.anthropicApiKey,
  keeperhub: {
    apiBaseUrl: cfg.keeperhubBaseUrl,
    apiToken: cfg.keeperhubApiToken,
    workflowId: cfg.keeperhubWorkflowId,
    pollerBaseUrl: cfg.pollerBaseUrl,
  },
  runtimeWsUrl: `ws://127.0.0.1:${cfg.httpPort}/runtime`,
});

httpServer.listen(cfg.httpPort, () => {
  // T-03-22: log only port + registry path (not registry contents)
  log({ msg: 'operator_listening', port: cfg.httpPort, registry: cfg.registryPath });
});
