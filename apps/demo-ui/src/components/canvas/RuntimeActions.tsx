import { useEffect, useRef, useState } from "react";
import type { RuntimeId } from "../../state/reducer.js";
import { useAgentBusy } from "../../state/hooks.js";
import { submitAgentPrompt } from "../../state/agentTurn.js";

/**
 * Floating action menu attached to a RuntimeNode. Opens on click of the
 * card, listing one-shot actions that route through the same /agent/chat
 * endpoint the chat input uses — no typing required, but the chat history
 * still gets the user/assistant pair so the rest of the demo stays in
 * sync (canvas animations, event log, on-chain rotation).
 */

interface Action {
  label: string;
  prompt: (id: RuntimeId) => string;
  variant?: "destructive";
}

const ACTIONS: ReadonlyArray<Action> = [
  { label: "Rotate keys", prompt: (id) => `rota las claves de ${id}` },
  { label: "Inspect events", prompt: (id) => `trae los ultimos 5 eventos del log de ${id}` },
  { label: "Simulate clone attack", prompt: (id) => `simula un clone attack contra ${id}` },
  { label: "Revoke runtime", prompt: (id) => `revocá el runtime ${id}`, variant: "destructive" },
];

export function RuntimeActions({
  runtimeId,
  open,
  onClose,
}: {
  runtimeId: RuntimeId;
  open: boolean;
  onClose: () => void;
}): JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null);
  const busy = useAgentBusy();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    const onClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    // Defer the click listener so the opening click doesn't immediately close.
    const t = setTimeout(() => window.addEventListener("click", onClick), 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleClick = async (action: Action): Promise<void> => {
    if (busy) return;
    onClose();
    await submitAgentPrompt(action.prompt(runtimeId));
  };

  return (
    <div
      ref={ref}
      className="runtime-actions"
      role="menu"
      aria-label={`${runtimeId} actions`}
      data-testid={`runtime-actions-${runtimeId}`}
    >
      {ACTIONS.map((a) => (
        <button
          key={a.label}
          type="button"
          role="menuitem"
          className={`runtime-actions-item${a.variant === "destructive" ? " runtime-actions-item--destructive" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            void handleClick(a);
          }}
          disabled={busy}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
