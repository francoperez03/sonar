import { getConfig } from './config.js';
import { Registry } from './registry/Registry.js';
import { ActiveSessions } from './sessions/ActiveSessions.js';
import { LogBus } from './log/LogBus.js';
import { HandshakeCoordinator } from './handshake/HandshakeCoordinator.js';
import * as nonces from './handshake/nonces.js';
import { createOperatorServer } from './http/server.js';
import { log } from './util/log.js';

// Top-level await: ESM + Node 20+ (D-14)
const cfg = getConfig();
const registry = await Registry.load(cfg.registryPath);
const sessions = new ActiveSessions();
const logBus = new LogBus();
const coordinator = new HandshakeCoordinator({ registry, sessions, logBus, nonceStore: nonces });
const { httpServer } = createOperatorServer({ registry, sessions, logBus, coordinator });

httpServer.listen(cfg.httpPort, () => {
  // T-03-22: log only port + registry path (not registry contents)
  log({ msg: 'operator_listening', port: cfg.httpPort, registry: cfg.registryPath });
});
