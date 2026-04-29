import type { Request, Response } from 'express';
import type { Registry } from '../../registry/Registry.js';

interface Deps {
  registry: Registry;
}

/**
 * GET /runtimes handler factory.
 * Returns [{ runtimeId, status, registeredAt }] — explicit field allow-list (T-03-17).
 * Never includes pubkey or lastHandshakeAt (CONTEXT D-13).
 */
export function runtimesRoute(deps: Deps) {
  return (_req: Request, res: Response): void => {
    const runtimes = deps.registry.list().map((r) => ({
      runtimeId: r.runtimeId,
      status: r.status,
      registeredAt: r.registeredAt,
    }));
    res.status(200).json({ runtimes });
  };
}
