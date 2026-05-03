/**
 * Compact on-chain pointer rendered in the topbar. Shows the FleetRegistry
 * contract that receives every WalletsDeprecated event so the evaluator can
 * jump straight to basescan and audit the chain side of the demo.
 */
const DEFAULT_FLEET_REGISTRY = '0x7eddfc8953a529ce7ffb35de2030f73aad89b31f';

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ChainBadge(): JSX.Element | null {
  const address =
    (import.meta.env.VITE_FLEET_REGISTRY_ADDRESS as string | undefined) ??
    DEFAULT_FLEET_REGISTRY;
  if (!address) return null;
  const href = `https://sepolia.basescan.org/address/${address}`;
  return (
    <a
      className="chain-badge"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`FleetRegistry on Base Sepolia · ${address}`}
      data-testid="chain-badge"
    >
      <span className="chain-badge-eyebrow">FLEET REGISTRY</span>
      <span className="chain-badge-address">{shortAddress(address)}</span>
    </a>
  );
}
