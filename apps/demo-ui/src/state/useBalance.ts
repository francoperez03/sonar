import { useEffect, useState } from "react";

/**
 * Polls Base Sepolia public RPC for the address' balance every `pollMs`.
 * Returns formatted-eth string (5 decimals) and an error flag. Browser-side
 * polling keeps the operator out of the read path; the trade-off is each
 * visitor hits the RPC themselves.
 */
const RPC_URL =
  (import.meta.env.VITE_BASE_SEPOLIA_RPC as string | undefined) ?? "https://sepolia.base.org";

interface BalanceResult {
  ethFormatted: string | null;
  loading: boolean;
  error: string | null;
}

export function useBalance(address: `0x${string}` | null, pollMs = 10_000): BalanceResult {
  const [state, setState] = useState<BalanceResult>({
    ethFormatted: null,
    loading: address != null,
    error: null,
  });

  useEffect(() => {
    if (!address) {
      setState({ ethFormatted: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    const fetchBalance = async (): Promise<void> => {
      try {
        const res = await fetch(RPC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getBalance",
            params: [address, "latest"],
          }),
        });
        const body = (await res.json().catch(() => null)) as { result?: string } | null;
        if (cancelled) return;
        if (!body?.result) {
          setState({ ethFormatted: null, loading: false, error: "rpc_no_result" });
          return;
        }
        const wei = BigInt(body.result);
        const eth = Number(wei) / 1e18;
        setState({ ethFormatted: eth.toFixed(5), loading: false, error: null });
      } catch (e) {
        if (cancelled) return;
        setState({
          ethFormatted: null,
          loading: false,
          error: e instanceof Error ? e.message : "rpc_error",
        });
      }
    };
    void fetchBalance();
    const t = setInterval(fetchBalance, pollMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [address, pollMs]);

  return state;
}
