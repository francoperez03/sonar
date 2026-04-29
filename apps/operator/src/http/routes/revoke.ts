import type { Request, Response } from 'express';
import { z } from 'zod';
import type { HandshakeCoordinator } from '../../handshake/HandshakeCoordinator.js';

export const RevokeRequest = z.object({
  runtimeId: z.string(),
  reason: z.string().optional(),
});
export type RevokeRequest = z.infer<typeof RevokeRequest>;

interface Deps {
  coordinator: HandshakeCoordinator;
}

/**
 * POST /revoke handler factory.
 * Validates body (T-03-16), calls coordinator.forceRevoke, returns 200 or 400.
 */
export function revokeRoute(deps: Deps) {
  return (req: Request, res: Response): void => {
    const parsed = RevokeRequest.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }
    deps.coordinator.forceRevoke(parsed.data.runtimeId, parsed.data.reason ?? 'operator_revoke');
    res.status(200).json({ status: 'revoked' });
  };
}
