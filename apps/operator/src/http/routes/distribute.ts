import type { Request, Response } from 'express';
import { z } from 'zod';
import naclUtil from 'tweetnacl-util';
import type { ActiveSessions } from '../../sessions/ActiveSessions.js';
import type { HandshakeCoordinator } from '../../handshake/HandshakeCoordinator.js';

export const DistributeRequest = z.object({
  runtimeId: z.string(),
  payload: z.string(), // base64
});
export type DistributeRequest = z.infer<typeof DistributeRequest>;

interface Deps {
  sessions: ActiveSessions;
  coordinator: HandshakeCoordinator;
}

/**
 * POST /distribute handler factory.
 * Validates body (T-03-15), checks session presence, drives full challenge→ack flow.
 * Returns 200 on ack, 409 on no session, 400 on bad body, 502 on coordinator failure.
 */
export function distributeRoute(deps: Deps) {
  return async (req: Request, res: Response): Promise<void> => {
    const parsed = DistributeRequest.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }
    const { runtimeId, payload } = parsed.data;

    // T-03-15: quick session check before any coordinator work
    if (!deps.sessions.has(runtimeId)) {
      res.status(409).json({ error: 'runtime_offline' });
      return;
    }

    const payloadBytes = naclUtil.decodeBase64(payload);

    // Issue challenge — sends ChallengeMsg through active WS, marks status 'awaiting'
    deps.coordinator.issueChallenge(runtimeId);

    // Wait for signed_response to arrive and pass IDEN-01 verification
    try {
      await deps.coordinator.awaitVerification(runtimeId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      if (msg === 'identity_unverified') {
        res.status(401).json({ error: 'identity_unverified' });
        return;
      }
      res.status(502).json({ error: 'distribute_failed', reason: msg });
      return;
    }

    // Verification passed — now distribute the encrypted payload and await ack
    try {
      const result = await deps.coordinator.distribute(runtimeId, payloadBytes);
      if (result.status === 'ready') {
        res.status(200).json({ status: 'ack' });
        return;
      }
      res.status(502).json({ error: 'distribute_failed', reason: (result as { status: 'failed'; reason: string }).reason });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      if (msg === 'runtime_offline') {
        res.status(409).json({ error: 'runtime_offline' });
        return;
      }
      if (msg === 'identity_unverified') {
        res.status(401).json({ error: 'identity_unverified' });
        return;
      }
      if (msg === 'ack_timeout') {
        res.status(502).json({ error: 'distribute_failed', reason: 'ack_timeout' });
        return;
      }
      res.status(502).json({ error: 'distribute_failed', reason: msg });
    }
  };
}
