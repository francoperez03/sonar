import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useAgentBusy } from '../../state/hooks.js';
import { submitAgentPrompt } from '../../state/agentTurn.js';

const PLACEHOLDER = 'Ask Sonar to inspect or rotate runtime keys';

const SUGGESTIONS: ReadonlyArray<{ label: string; prompt: string }> = [
  { label: 'List runtimes', prompt: 'list runtimes' },
  { label: 'Rotate alpha', prompt: 'rota las claves de alpha' },
  { label: 'Simulate clone attack', prompt: 'simula un clone attack contra alpha' },
  { label: 'Reset demo', prompt: 'reset the demo' },
];

/**
 * ChatInput — Phase 7 agent driver. Submits the prompt to the Operator's
 * /agent/chat SSE endpoint. The user message and final assistant message
 * are mirrored into ChatMirror via the WS /logs broadcast (LogBus); the
 * SSE token stream feeds a local draft bubble for streaming feel.
 */
export function ChatInput(): JSX.Element {
  const [text, setText] = useState('');
  const busy = useAgentBusy();

  const submit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (busy || !text.trim()) return;
    const t = text;
    setText('');
    await submitAgentPrompt(t);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  const onSuggestionClick = async (prompt: string): Promise<void> => {
    if (busy) return;
    setText('');
    await submitAgentPrompt(prompt);
  };

  return (
    <div className="chat-input-wrapper">
      <div
        className="chat-suggestions"
        role="group"
        aria-label="Prompt suggestions"
        data-testid="chat-suggestions"
      >
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            type="button"
            className="chat-suggestion"
            onClick={() => void onSuggestionClick(s.prompt)}
            disabled={busy}
            title={s.prompt}
          >
            {s.label}
          </button>
        ))}
      </div>
      <form className="chat-input" onSubmit={submit} aria-label="Agent prompt">
        <textarea
          className="chat-input-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={PLACEHOLDER}
          rows={2}
          disabled={busy}
          data-testid="chat-input"
        />
        <button
          type="submit"
          className="chat-input-send"
          disabled={busy || !text.trim()}
          data-testid="chat-input-send"
        >
          {busy ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
