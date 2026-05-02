import { ChatMirror } from "../sidebar/ChatMirror.js";
import { ChatInput } from "../sidebar/ChatInput.js";
import { EventLog } from "../sidebar/EventLog.js";

/**
 * Sidebar — vertical stack: ChatMirror (top) + EventLog (bottom). Per UI-SPEC
 * §Layout Contract and CONTEXT D-02. The visually-hidden h2 surfaces the
 * "Sonar — Live Rotation" header to assistive tech without painting it.
 */
export function Sidebar(): JSX.Element {
  return (
    <aside className="demo-sidebar" aria-label="Sidebar">
      <h2 className="visually-hidden">Sonar — Live Rotation</h2>
      <section className="demo-sidebar-section" aria-label="Chat mirror">
        <div className="demo-eyebrow">CHAT</div>
        <ChatMirror />
        <ChatInput />
      </section>
      <section className="demo-sidebar-section" aria-label="Event log">
        <div className="demo-eyebrow">EVENTS</div>
        <EventLog />
      </section>
    </aside>
  );
}
