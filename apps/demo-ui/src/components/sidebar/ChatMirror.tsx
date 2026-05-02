import { Virtuoso } from "react-virtuoso";
import { useChats, useAgentDraft } from "../../state/hooks.js";
import type { ChatRow } from "../../state/reducer.js";

/**
 * ChatMirror — bubble chat (DEMO-01). Reads useChats() (the reducer keeps chat
 * messages out of state.events per D-07) and renders alternating user/assistant
 * bubbles via react-virtuoso.
 *
 * RESEARCH Pitfall 3: followOutput="smooth" suits conversational pace; the
 * EventLog uses "auto" (snap) for rapid bursts.
 *
 * RESEARCH Pitfall 4: atBottomThreshold={48} — autoscroll only kicks in when
 * the user is already near the bottom; a scrolled-up reader is not yanked.
 *
 * Threat T-06-14: bubble content rendered as a React text child — escaping
 * is automatic; no dangerouslySetInnerHTML anywhere.
 */
export function ChatMirror(): JSX.Element {
  const chats = useChats();
  const draft = useAgentDraft();

  if (chats.length === 0 && !draft) {
    return (
      <div className="chat-mirror-empty" aria-live="polite">
        <div className="chat-mirror-empty-heading">Awaiting prompt</div>
        <p className="chat-mirror-empty-body">
          Type below to drive the agent — or trigger a rotation from Claude Desktop.
        </p>
      </div>
    );
  }
  const data: ChatRow[] = draft
    ? [
        ...chats,
        {
          id: "__draft__",
          role: "assistant",
          content: draft.text || "…",
          timestamp: draft.startedAt,
        },
      ]
    : chats;
  return (
    <Virtuoso
      style={{ height: 320 }}
      data={data}
      followOutput="smooth"
      atBottomThreshold={48}
      initialItemCount={data.length}
      itemContent={(_index, c): JSX.Element => <ChatBubble row={c} />}
      aria-live="polite"
    />
  );
}

function ChatBubble({ row }: { row: ChatRow }): JSX.Element {
  return (
    <div className={`chat-bubble chat-bubble--${row.role}`} data-role={row.role}>
      <div className="chat-bubble-content">{row.content}</div>
    </div>
  );
}
