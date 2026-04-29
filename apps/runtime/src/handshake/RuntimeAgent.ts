import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import type { ITransport } from '@sonar/shared';
import type { Message } from '@sonar/shared';
import { decryptPayload } from '../crypto/decrypt.js';
import { log } from '../util/log.js';

export interface AgentDeps {
  transport: ITransport;
  runtimeId: string;
  signingKeypair: nacl.SignKeyPair;
}

export class RuntimeAgent {
  constructor(private deps: AgentDeps) {
    deps.transport.onMessage((msg) => this.dispatch(msg).catch((e) => {
      log({ msg: 'dispatch_error', err: String(e), level: 'error' });
    }));
  }

  register(pubkeyB64: string): Promise<void> {
    return this.deps.transport.send({
      type: 'register',
      runtimeId: this.deps.runtimeId,
      pubkey: pubkeyB64,
    });
  }

  private async dispatch(msg: Message): Promise<void> {
    switch (msg.type) {
      case 'registered':
        log({ msg: 'registered', runtimeId: msg.runtimeId });
        return;

      case 'challenge': {
        // D-06: domain separation — concat(nonce, runtimeId)
        const nonceBytes = naclUtil.decodeBase64(msg.nonce);
        const idBytes = naclUtil.decodeUTF8(msg.runtimeId);
        const message = new Uint8Array(nonceBytes.length + idBytes.length);
        message.set(nonceBytes, 0);
        message.set(idBytes, nonceBytes.length);
        const signature = naclUtil.encodeBase64(
          nacl.sign.detached(message, this.deps.signingKeypair.secretKey)
        );
        await this.deps.transport.send({
          type: 'signed_response',
          runtimeId: this.deps.runtimeId,
          signature,
        });
        return;
      }

      case 'encrypted_payload': {
        try {
          const bytes = decryptPayload(msg, this.deps.signingKeypair.secretKey);
          log({ msg: 'payload_decrypted', runtimeId: msg.runtimeId, bytes: bytes.length });
          await this.deps.transport.send({
            type: 'ack',
            runtimeId: this.deps.runtimeId,
            status: 'ready',
          });
        } catch (e) {
          const reason = e instanceof Error ? e.message : 'unknown';
          await this.deps.transport.send({
            type: 'ack',
            runtimeId: this.deps.runtimeId,
            status: 'failed',
            reason,
          });
        }
        return;
      }

      case 'revoked':
        log({ msg: 'revoked_received', runtimeId: msg.runtimeId, level: 'warn' });
        // Demo behaviour: stay alive; Operator has already closed the WS.
        return;

      case 'log_entry':
      case 'status_change':
        log({ msg: 'operator_event', event: msg });
        return;

      // Server should never send these to us, but be defensive:
      case 'register':
      case 'signed_response':
      case 'ack':
      case 'revoke':
        log({ msg: 'unexpected_inbound', type: msg.type, level: 'warn' });
        return;
    }
  }
}
