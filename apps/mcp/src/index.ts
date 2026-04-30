// Stub — real implementation lands in later Phase 4 plans (04-02, 04-03).
// stdout in this process is reserved for MCP JSON-RPC framing; use the
// stderr-only logger from util/log.ts for any diagnostics.
import type { ITransport } from '@sonar/shared';
import { log } from './util/log.js';

export const _placeholderTransportType = (t: ITransport) => t;
log({ msg: 'mcp_stub_boot', note: 'real implementation lands in Phase 4 Plans 02-03' });
