import { z } from 'zod';
import { ChallengeMsg, SignedResponseMsg, EncryptedPayloadMsg, AckMsg } from './handshake.js';
import { RegisterMsg, RegisteredMsg, RevokeMsg, RevokedMsg } from './registry.js';
import { LogEntryMsg, StatusChangeMsg } from './log.js';
import { ChatMsg } from './chat.js';

export const Message = z.discriminatedUnion('type', [
  ChallengeMsg,
  SignedResponseMsg,
  EncryptedPayloadMsg,
  AckMsg,
  RegisterMsg,
  RegisteredMsg,
  RevokeMsg,
  RevokedMsg,
  LogEntryMsg,
  StatusChangeMsg,
  ChatMsg,
]);
export type Message = z.infer<typeof Message>;

export * from './handshake.js';
export * from './registry.js';
export * from './log.js';
export * from './chat.js';
