import { getConfig } from './config.js';
import { generateKeypair } from './identity/keypair.js';
import { createClientTransport } from './transport/createClientTransport.js';
import { RuntimeAgent } from './handshake/RuntimeAgent.js';
import { log } from './util/log.js';

const cfg = getConfig();
const { keypair, pubkeyB64 } = generateKeypair();

// Holder pattern: the initial 'open' fires synchronously inside createClientTransport,
// before `transport` is assigned (TDZ). Reconnect onOpen calls land after assignment.
const holder: { transport?: Awaited<ReturnType<typeof createClientTransport>> } = {};

const sendRegister = () =>
  holder.transport
    ?.send({ type: 'register', runtimeId: cfg.runtimeId, pubkey: pubkeyB64 })
    .catch((e) => log({ msg: 'register_send_failed', err: String(e), level: 'warn' }));

const transport = await createClientTransport({
  url: cfg.operatorUrl,
  // D-11: re-send RegisterMsg on every fresh open (including reconnects).
  // The very first open is handled by the explicit sendRegister() below.
  onOpen: () => sendRegister(),
});
holder.transport = transport;

new RuntimeAgent({ transport, runtimeId: cfg.runtimeId, signingKeypair: keypair });
log({ msg: 'runtime_started', runtimeId: cfg.runtimeId, pubkey: pubkeyB64 });

// Initial register: the first 'open' event fired before holder.transport was set,
// so the onOpen above was a no-op for the initial connection.
await sendRegister();
