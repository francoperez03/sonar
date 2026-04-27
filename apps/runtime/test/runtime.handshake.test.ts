import { describe, it, expect, afterEach } from 'vitest';
import { WebSocketServer, WebSocket as WsClient } from 'ws';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import ed2curve from 'ed2curve';
import net from 'node:net';

// RED: createClientTransport + RuntimeAgent don't exist yet
import { createClientTransport } from '../src/transport/createClientTransport.js';
import { RuntimeAgent } from '../src/handshake/RuntimeAgent.js';
import { generateKeypair } from '../src/identity/keypair.js';
import type { EncryptedPayloadMsg, Message } from '@sonar/shared';

// Allocate an ephemeral port
function allocPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (!addr || typeof addr === 'string') return reject(new Error('bad addr'));
      const port = addr.port;
      srv.close(() => resolve(port));
    });
  });
}

function localEncrypt(payload: Uint8Array, edPubB64: string): EncryptedPayloadMsg {
  const xpub = ed2curve.convertPublicKey(naclUtil.decodeBase64(edPubB64));
  if (!xpub) throw new Error('bad pubkey');
  const eph = nacl.box.keyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ct = nacl.box(payload, nonce, xpub, eph.secretKey);
  return {
    type: 'encrypted_payload',
    runtimeId: 'alpha',
    ciphertext: naclUtil.encodeBase64(ct),
    ephemeralPubkey: naclUtil.encodeBase64(eph.publicKey),
    nonce: naclUtil.encodeBase64(nonce),
  };
}

function sendToClient(ws: WsClient, msg: Message) {
  ws.send(JSON.stringify(msg));
}

let wss: WebSocketServer | null = null;

afterEach(async () => {
  if (wss) {
    await new Promise<void>((resolve) => {
      // terminate all clients first
      wss!.clients.forEach((c) => c.terminate());
      wss!.close(() => resolve());
    });
    wss = null;
  }
});

describe('runtime.handshake', () => {
  it('case 1: register on open — server receives RegisterMsg within 1s', async () => {
    const port = await allocPort();
    wss = new WebSocketServer({ port, host: '127.0.0.1' });

    const { keypair, pubkeyB64 } = generateKeypair();

    const registerPromise = new Promise<Message>((resolve) => {
      wss!.on('connection', (ws) => {
        ws.on('message', (raw) => {
          const msg = JSON.parse(raw.toString()) as Message;
          resolve(msg);
        });
      });
    });

    const transport = await createClientTransport({
      url: `ws://127.0.0.1:${port}`,
      onOpen: () => {
        transport.send({ type: 'register', runtimeId: 'alpha', pubkey: pubkeyB64 }).catch(() => {});
      },
    });

    new RuntimeAgent({ transport, runtimeId: 'alpha', signingKeypair: keypair });

    const msg = await registerPromise;
    expect(msg.type).toBe('register');
    if (msg.type === 'register') {
      expect(msg.runtimeId).toBe('alpha');
      expect(msg.pubkey).toBe(pubkeyB64);
    }

    await transport.close();
  }, 8000);

  it('case 2: sign challenge correctly — signature verifies with nacl.sign.detached.verify', async () => {
    const port = await allocPort();
    wss = new WebSocketServer({ port, host: '127.0.0.1' });

    const { keypair, pubkeyB64 } = generateKeypair();
    let serverConn: WsClient;

    const signedResponsePromise = new Promise<{ signature: string }>((resolve) => {
      wss!.on('connection', (ws) => {
        serverConn = ws;
        ws.on('message', (raw) => {
          const msg = JSON.parse(raw.toString()) as Message;
          if (msg.type === 'register') {
            // Send challenge
            const nonce = naclUtil.encodeBase64(nacl.randomBytes(32));
            ws.send(JSON.stringify({ type: 'challenge', nonce, runtimeId: 'alpha' }));
          } else if (msg.type === 'signed_response') {
            resolve({ signature: msg.signature });
          }
        });
      });
    });

    let challengeNonce = '';
    wss!.on('connection', (ws) => {
      const orig = ws.listeners('message')[0] as (raw: Buffer) => void;
      ws.removeListener('message', orig);
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString()) as Message;
        if (msg.type === 'register') {
          challengeNonce = naclUtil.encodeBase64(nacl.randomBytes(32));
          ws.send(JSON.stringify({ type: 'challenge', nonce: challengeNonce, runtimeId: 'alpha' }));
        } else if (msg.type === 'signed_response') {
          signedResponsePromise;
        }
      });
    });

    // Simpler approach: build a direct test server
    await new Promise<void>((resolve) => wss!.close(() => {
      wss = null;
      resolve();
    }));

    wss = new WebSocketServer({ port, host: '127.0.0.1' });
    let capturedNonce = '';
    let capturedPubkey = '';

    const signedResponseP = new Promise<string>((resolve) => {
      wss!.on('connection', (ws) => {
        ws.on('message', (raw) => {
          const msg = JSON.parse(raw.toString()) as Message;
          if (msg.type === 'register') {
            capturedPubkey = msg.pubkey;
            capturedNonce = naclUtil.encodeBase64(nacl.randomBytes(32));
            ws.send(JSON.stringify({ type: 'challenge', nonce: capturedNonce, runtimeId: 'alpha' }));
          } else if (msg.type === 'signed_response') {
            resolve(msg.signature);
          }
        });
      });
    });

    const transport = await createClientTransport({ url: `ws://127.0.0.1:${port}` });
    new RuntimeAgent({ transport, runtimeId: 'alpha', signingKeypair: keypair });
    // Register manually
    await transport.send({ type: 'register', runtimeId: 'alpha', pubkey: pubkeyB64 });

    const sig = await signedResponseP;

    // Verify signature
    const nonceBytes = naclUtil.decodeBase64(capturedNonce);
    const idBytes = naclUtil.decodeUTF8('alpha');
    const message = new Uint8Array(nonceBytes.length + idBytes.length);
    message.set(nonceBytes, 0);
    message.set(idBytes, nonceBytes.length);
    const pubkeyBytes = naclUtil.decodeBase64(pubkeyB64);
    const sigBytes = naclUtil.decodeBase64(sig);
    const valid = nacl.sign.detached.verify(message, sigBytes, pubkeyBytes);
    expect(valid).toBe(true);

    await transport.close();
  }, 8000);

  it('case 3: decrypt + ack — server sends encrypted_payload, receives ack:ready', async () => {
    const port = await allocPort();
    wss = new WebSocketServer({ port, host: '127.0.0.1' });

    const { keypair, pubkeyB64 } = generateKeypair();

    const ackPromise = new Promise<Message>((resolve) => {
      wss!.on('connection', (ws) => {
        ws.on('message', (raw) => {
          const msg = JSON.parse(raw.toString()) as Message;
          if (msg.type === 'register') {
            const encMsg = localEncrypt(Uint8Array.from([7, 7, 7]), msg.pubkey);
            ws.send(JSON.stringify(encMsg));
          } else if (msg.type === 'ack') {
            resolve(msg);
          }
        });
      });
    });

    const transport = await createClientTransport({ url: `ws://127.0.0.1:${port}` });
    new RuntimeAgent({ transport, runtimeId: 'alpha', signingKeypair: keypair });
    await transport.send({ type: 'register', runtimeId: 'alpha', pubkey: pubkeyB64 });

    const ack = await ackPromise;
    expect(ack.type).toBe('ack');
    if (ack.type === 'ack') {
      expect(ack.status).toBe('ready');
    }

    await transport.close();
  }, 8000);

  it('case 4: bad ciphertext → ack:failed', async () => {
    const port = await allocPort();
    wss = new WebSocketServer({ port, host: '127.0.0.1' });

    const { keypair, pubkeyB64 } = generateKeypair();

    const ackPromise = new Promise<Message>((resolve) => {
      wss!.on('connection', (ws) => {
        ws.on('message', (raw) => {
          const msg = JSON.parse(raw.toString()) as Message;
          if (msg.type === 'register') {
            const encMsg = localEncrypt(Uint8Array.from([7, 7, 7]), msg.pubkey);
            // Tamper ciphertext
            const ctBytes = naclUtil.decodeBase64(encMsg.ciphertext);
            ctBytes[0] = ctBytes[0] ^ 0xff;
            const tampered = { ...encMsg, ciphertext: naclUtil.encodeBase64(ctBytes) };
            ws.send(JSON.stringify(tampered));
          } else if (msg.type === 'ack') {
            resolve(msg);
          }
        });
      });
    });

    const transport = await createClientTransport({ url: `ws://127.0.0.1:${port}` });
    new RuntimeAgent({ transport, runtimeId: 'alpha', signingKeypair: keypair });
    await transport.send({ type: 'register', runtimeId: 'alpha', pubkey: pubkeyB64 });

    const ack = await ackPromise;
    expect(ack.type).toBe('ack');
    if (ack.type === 'ack') {
      expect(ack.status).toBe('failed');
      expect(ack.reason).toBeTruthy();
    }

    await transport.close();
  }, 8000);

  it('case 5: invalid frame → server observes close with code 1003', async () => {
    const port = await allocPort();
    wss = new WebSocketServer({ port, host: '127.0.0.1' });

    const closePromise = new Promise<number>((resolve) => {
      wss!.on('connection', (ws) => {
        ws.on('close', (code) => resolve(code));
      });
    });

    const transport = await createClientTransport({ url: `ws://127.0.0.1:${port}` });

    // Wait for connection to open, then wait for server to set up listener
    await new Promise<void>((r) => setTimeout(r, 50));

    // Get the raw ws from the server side and send invalid json
    const serverWs = [...wss!.clients][0];
    if (serverWs) {
      serverWs.send('totally not json');
    }

    const code = await closePromise;
    expect(code).toBe(1003);

    // transport may already be closed by the server; just ignore close errors
    await transport.close().catch(() => {});
  }, 8000);

  it('case 6: reconnect re-registers — after server closes, runtime re-connects and re-sends RegisterMsg', async () => {
    const port = await allocPort();
    wss = new WebSocketServer({ port, host: '127.0.0.1' });

    const { keypair, pubkeyB64 } = generateKeypair();

    // Track connections and register messages
    let connectionCount = 0;
    const secondRegisterPromise = new Promise<Message>((resolve) => {
      wss!.on('connection', (ws) => {
        connectionCount++;
        ws.on('message', (raw) => {
          const msg = JSON.parse(raw.toString()) as Message;
          if (msg.type === 'register' && connectionCount >= 2) {
            resolve(msg);
          } else if (msg.type === 'register' && connectionCount === 1) {
            // Force close after first register
            setTimeout(() => ws.close(), 50);
          }
        });
      });
    });

    const transport = await createClientTransport({
      url: `ws://127.0.0.1:${port}`,
      onOpen: () => {
        transport.send({ type: 'register', runtimeId: 'alpha', pubkey: pubkeyB64 }).catch(() => {});
      },
    });

    new RuntimeAgent({ transport, runtimeId: 'alpha', signingKeypair: keypair });

    const msg = await secondRegisterPromise;
    expect(msg.type).toBe('register');
    if (msg.type === 'register') {
      expect(msg.runtimeId).toBe('alpha');
    }
    expect(connectionCount).toBeGreaterThanOrEqual(2);

    await transport.close();
  }, 10000);
});
