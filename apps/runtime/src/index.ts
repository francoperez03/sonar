import { getConfig } from './config.js';
import { generateKeypair } from './identity/keypair.js';
import { createClientTransport } from './transport/createClientTransport.js';
import { RuntimeAgent } from './handshake/RuntimeAgent.js';
import { log } from './util/log.js';

const cfg = getConfig();
const { keypair, pubkeyB64 } = generateKeypair();

const transport = await createClientTransport({
  url: cfg.operatorUrl,
  onOpen: () => {
    // D-11: re-send RegisterMsg on every fresh open (including reconnects)
    transport
      .send({ type: 'register', runtimeId: cfg.runtimeId, pubkey: pubkeyB64 })
      .catch((e) => log({ msg: 'register_send_failed', err: String(e), level: 'warn' }));
  },
});

new RuntimeAgent({ transport, runtimeId: cfg.runtimeId, signingKeypair: keypair });
log({ msg: 'runtime_started', runtimeId: cfg.runtimeId, pubkey: pubkeyB64 });
