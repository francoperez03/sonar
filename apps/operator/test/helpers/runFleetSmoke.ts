/**
 * Programmatic fleet bootstrap helper for integration tests (Plan 03-05).
 * Spins up a real Operator + N RuntimeAgent instances on ephemeral ports.
 * Used by oper-05.invariant, iden-01.gate, iden-02.clone-rejected, iden-03.revoke,
 * and distribute.happy tests.
 *
 * NOT called by fleet-smoke.sh (that's a bash-level demo script).
 * NOT calling process.exit — clean shutdown is via FleetHarness.close().
 */
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import WebSocket from 'ws';
import type { LogEntryMsg, StatusChangeMsg } from '@sonar/shared';
import { Registry } from '../../src/registry/Registry.js';
import { ActiveSessions } from '../../src/sessions/ActiveSessions.js';
import { LogBus } from '../../src/log/LogBus.js';
import { HandshakeCoordinator } from '../../src/handshake/HandshakeCoordinator.js';
import * as defaultNonces from '../../src/handshake/nonces.js';
import { createOperatorServer } from '../../src/http/server.js';
import { PrivkeyVault } from '../../src/rotation/PrivkeyVault.js';
import { RuntimeAgent } from '../../../runtime/src/handshake/RuntimeAgent.js';
import { createClientTransport } from '../../../runtime/src/transport/createClientTransport.js';
import { allocPort, tempRegistryPath } from '../setup.js';
import type { Server } from 'node:http';
import type { ITransport } from '@sonar/shared';

export interface RuntimeHarness {
  runtimeId: string;
  agent: RuntimeAgent;
  transport: ITransport;
  pubkeyB64: string;
  signingKeypair: nacl.SignKeyPair;
  receivedBytes: Uint8Array[];
  close: () => Promise<void>;
}

export interface OperatorHarness {
  httpServer: Server;
  registry: Registry;
  logBus: LogBus;
  coordinator: HandshakeCoordinator;
  sessions: ActiveSessions;
  close: () => Promise<void>;
}

export interface FleetHarness {
  operatorPort: number;
  operator: OperatorHarness;
  runtimes: RuntimeHarness[];
  logsTranscript: Array<LogEntryMsg | StatusChangeMsg>;
  close: () => Promise<void>;
}

export interface FleetOpts {
  ids: string[];
  /** Customise the nonce TTL for the stale-nonce test seam. Default: 10_000. T-03-36. */
  nonceTtlMs?: number;
  /** Override nonce store for injection. Default: real defaultNonces. */
  nonceStore?: typeof defaultNonces;
}

/**
 * Boot a real Operator + N RuntimeAgents in-process.
 * Returns once every runtime has received its `RegisteredMsg`.
 */
export async function runFleetSmoke(opts: FleetOpts): Promise<FleetHarness> {
  const { ids, nonceStore } = opts;

  // ── Build nonce store with optional custom TTL ──────────────────────────────
  let nonces: typeof defaultNonces;
  if (nonceStore) {
    nonces = nonceStore;
  } else if (opts.nonceTtlMs !== undefined && opts.nonceTtlMs !== 10_000) {
    nonces = makeScopedNonces(opts.nonceTtlMs);
  } else {
    nonces = defaultNonces;
  }

  // ── Spin up Operator ────────────────────────────────────────────────────────
  const port = await allocPort();
  const registry = await Registry.load(tempRegistryPath());
  const sessions = new ActiveSessions();
  const logBus = new LogBus();
  const coordinator = new HandshakeCoordinator({ registry, sessions, logBus, nonceStore: nonces });
  const vault = new PrivkeyVault();
  const { httpServer } = createOperatorServer({ registry, sessions, logBus, coordinator, vault, webhookSecret: 'test-secret' });

  await new Promise<void>((resolve) => httpServer.listen(port, '127.0.0.1', () => resolve()));

  // ── Subscribe to /logs transcript ───────────────────────────────────────────
  const logsTranscript: Array<LogEntryMsg | StatusChangeMsg> = [];
  const logsWs = new WebSocket(`ws://127.0.0.1:${port}/logs`);
  await new Promise<void>((resolve, reject) => {
    logsWs.once('open', () => resolve());
    logsWs.once('error', reject);
  });
  logsWs.on('message', (raw) => {
    try {
      const evt = JSON.parse(raw.toString()) as LogEntryMsg | StatusChangeMsg;
      logsTranscript.push(evt);
    } catch { /* ignore parse errors */ }
  });

  // ── Boot each runtime ───────────────────────────────────────────────────────
  const runtimes: RuntimeHarness[] = [];

  for (const runtimeId of ids) {
    const signingKeypair = nacl.sign.keyPair();
    const pubkeyB64 = naclUtil.encodeBase64(signingKeypair.publicKey);
    const receivedBytes: Uint8Array[] = [];

    // Wait until the logBus emits status_change → 'registered' for this runtimeId
    const registeredPromise = new Promise<void>((resolve) => {
      const unsub = logBus.subscribe((evt) => {
        if (
          evt.type === 'status_change' &&
          (evt as StatusChangeMsg).runtimeId === runtimeId &&
          (evt as StatusChangeMsg).status === 'registered'
        ) {
          unsub();
          resolve();
        }
      });
    });

    // Use holder pattern (documented in 03-04-SUMMARY.md) to avoid TDZ ReferenceError.
    // createClientTransport calls onOpen during the await itself; `transport` isn't
    // assigned yet, so we use a holder object that is populated after await resolves.
    const holder: { transport?: ITransport } = {};

    const transport = await createClientTransport({
      url: `ws://127.0.0.1:${port}/runtime`,
      onOpen: () => {
        void holder.transport?.send({
          type: 'register',
          runtimeId,
          pubkey: pubkeyB64,
        });
      },
    });
    holder.transport = transport;

    // Belt-and-suspenders: if onOpen already fired before holder was set, send now.
    // The registered Promise guards against double-registration issues.
    void transport.send({
      type: 'register',
      runtimeId,
      pubkey: pubkeyB64,
    }).catch(() => { /* socket may already be registered */ });

    const agent = new RuntimeAgent({ transport, runtimeId, signingKeypair });

    await registeredPromise;

    const closeRuntime = async () => {
      await transport.close();
    };

    runtimes.push({ runtimeId, agent, transport, pubkeyB64, signingKeypair, receivedBytes, close: closeRuntime });
  }

  // ── Operator close helper ───────────────────────────────────────────────────
  const closeOperator = () =>
    new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });

  const operatorHarness: OperatorHarness = {
    httpServer,
    registry,
    logBus,
    coordinator,
    sessions,
    close: closeOperator,
  };

  const closeAll = async () => {
    // Close runtimes first (prevents reconnect spam)
    await Promise.all(runtimes.map((r) => r.close()));
    // Close /logs subscriber
    if (logsWs.readyState < 2) {
      await new Promise<void>((resolve) => {
        logsWs.once('close', () => resolve());
        logsWs.close();
      });
    }
    // Close operator
    await closeOperator();
  };

  return {
    operatorPort: port,
    operator: operatorHarness,
    runtimes,
    logsTranscript,
    close: closeAll,
  };
}

// ── Internal: scoped nonce store with custom TTL (T-03-36 test seam) ─────────
// TTL is a constructor param with default 10_000; not env-driven; cannot be
// overridden by an attacker because it is compile-time only. (Accepted: T-03-36)
function makeScopedNonces(ttlMs: number): typeof defaultNonces {
  interface Entry { runtimeId: string; expiresAt: number; }
  const store = new Map<string, Entry>();
  const { randomBytes } = require('node:crypto') as typeof import('node:crypto');
  const naclUtilLocal = require('tweetnacl-util') as typeof import('tweetnacl-util');

  setInterval(() => {
    const now = Date.now();
    for (const [n, e] of store) if (now > e.expiresAt) store.delete(n);
  }, Math.max(ttlMs, 10)).unref();

  const issue = (runtimeId: string): string => {
    const nonce = naclUtilLocal.encodeBase64(randomBytes(32));
    store.set(nonce, { runtimeId, expiresAt: Date.now() + ttlMs });
    return nonce;
  };

  const consume = (nonce: string, runtimeId: string): boolean => {
    const e = store.get(nonce);
    if (!e || e.runtimeId !== runtimeId || Date.now() > e.expiresAt) {
      store.delete(nonce);
      return false;
    }
    store.delete(nonce);
    return true;
  };

  const peek = (nonce: string): Entry | undefined => store.get(nonce);

  return { issue, consume, peek };
}
