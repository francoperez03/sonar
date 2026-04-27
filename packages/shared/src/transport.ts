import type { Message } from './messages/index.js';

export type Unsubscribe = () => void;

export interface ITransport {
  send(msg: Message): Promise<void>;
  onMessage(handler: (msg: Message) => void): Unsubscribe;
  close(): Promise<void>;
}

// Factory signatures only — Phase 3 (WebSocket) and Phase 6 (AXL) provide impls.
export interface ServerTransportOpts {
  [key: string]: unknown;
}

export interface ClientTransportOpts {
  [key: string]: unknown;
}

export type CreateServerTransport = (opts: ServerTransportOpts) => Promise<ITransport>;
export type CreateClientTransport = (opts: ClientTransportOpts) => Promise<ITransport>;
