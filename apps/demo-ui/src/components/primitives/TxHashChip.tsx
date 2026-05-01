interface Props {
  hash: string;
}

/**
 * TxHashChip — footer chip rendering `0x{first6}…{last4}` in mono with click-to-copy
 * and a Base Sepolia explorer link (CLAUDE.md: chain locked to Base Sepolia).
 *
 * Threat T-06-15 (Information Disclosure): rel="noopener noreferrer" on the
 * external link prevents window.opener leakage to basescan.org. Threat T-06-16
 * (URL injection): hash is sourced from the reducer's strict 0x[a-fA-F0-9]{64}
 * regex match, so URL interpolation is structurally bounded.
 */
export function TxHashChip({ hash }: Props): JSX.Element {
  const truncated = `0x${hash.slice(2, 8)}…${hash.slice(-4)}`;
  const explorerUrl = `https://sepolia.basescan.org/tx/${hash}`;
  const onCopy = (): void => {
    void navigator.clipboard?.writeText(hash);
  };
  return (
    <span className="tx-hash-chip">
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${hash}`}
        className="tx-hash-chip-button"
      >
        {truncated}
      </button>
      <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
        View on Base Sepolia
      </a>
    </span>
  );
}
