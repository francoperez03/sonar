import { Virtuoso } from "react-virtuoso";
import { useChats } from "../../state/hooks.js";
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
  if (chats.length === 0) {
    return (
      <div className="chat-mirror-empty" aria-live="polite">
        <div className="chat-mirror-empty-heading">Awaiting prompt</div>
        <p className="chat-mirror-empty-body">
          Trigger a rotation from Claude Desktop to mirror the conversation here.
        </p>
      </div>
    );
  }
  return (
    <Virtuoso
      style={{ height: 320 }}
      data={chats}
      followOutput="smooth"
      atBottomThreshold={48}
      initialItemCount={chats.length}
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
