import { motion } from 'framer-motion';
import type { RuntimeView } from '../../state/reducer.js';
import { StatusPill } from '../primitives/StatusPill.js';
import { IdentityStrip } from '../primitives/IdentityStrip.js';
import { useBalance } from '../../state/useBalance.js';

/**
 * RuntimeNode — visual card for a single runtime (alpha/beta/gamma/gamma-clone).
 * Composes:
 *   - <StatusPill> (6-state pill)
 *   - <IdentityStrip> (4..4 pubkey + relative timestamp)
 *
 * gamma-clone is the cinematic ghost (CONTEXT D-11): desaturated at idle,
 * destructive flash on `clone-rejected` (CSS keyframes in demo.css).
 *
 * Layout transitions use framer-motion's `layout` prop with the
 * Motion Contract's standard ease + duration.base.
 */
function shortAddress(addr: `0x${string}`): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function RuntimeNode({ runtime }: { runtime: RuntimeView }): JSX.Element {
  const isGhost = runtime.id === 'gamma-clone';
  const kind = isGhost ? 'clone candidate' : 'legit runtime';
  const cls =
    `runtime-node runtime-node--${runtime.status} runtime-node--${runtime.id}` +
    (isGhost ? ' runtime-node--ghost' : '');
  const { ethFormatted, loading: balanceLoading } = useBalance(runtime.walletAddress);
  return (
    <motion.div
      className={cls}
      data-testid={`runtime-node-${runtime.id}`}
      layout
      transition={{ layout: { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] } }}
    >
      <div className="runtime-node-topline">
        <div>
          <div className="runtime-node-kind">{kind}</div>
          <div className="runtime-node-name">{runtime.id.toUpperCase()}</div>
        </div>
        <span className="runtime-node-led" aria-hidden="true" />
      </div>
      <div className="runtime-node-status-row">
        <StatusPill status={runtime.status} />
      </div>
      {runtime.walletAddress && (
        <div className="runtime-node-wallet" data-testid={`runtime-wallet-${runtime.id}`}>
          <a
            className="runtime-node-wallet-address"
            href={`https://sepolia.basescan.org/address/${runtime.walletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            title={runtime.walletAddress}
          >
            {shortAddress(runtime.walletAddress)}
          </a>
          <span className="runtime-node-wallet-balance">
            {balanceLoading ? '…' : ethFormatted != null ? `${ethFormatted} ETH` : '—'}
          </span>
        </div>
      )}
      <div className="runtime-node-divider" aria-hidden="true" />
      <IdentityStrip pubkey={runtime.pubkey} lastEventAt={runtime.lastEventAt} />
    </motion.div>
  );
}
