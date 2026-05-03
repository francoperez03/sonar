import { ChatMirror } from '../sidebar/ChatMirror.js';
import { ChatInput } from '../sidebar/ChatInput.js';
import { EventLog } from '../sidebar/EventLog.js';

/**
 * Sidebar — vertical stack: agent conversation on top, operator stream below.
 * The user can prompt Sonar and watch the runtime telemetry in the same rail.
 */
export function Sidebar(): JSX.Element {
  return (
    <aside className="demo-sidebar" aria-label="Sidebar">
      <h2 className="visually-hidden">Sonar — Live Rotation</h2>
      <section className="demo-sidebar-section" aria-label="Chat mirror">
        <div className="demo-section-head">
          <div>
            <div className="demo-eyebrow">AGENT RUNTIME</div>
            <div className="demo-section-kicker">Claude Desktop / MCP driver</div>
          </div>
          <span className="demo-section-index">01</span>
        </div>
        <ChatMirror />
        <ChatInput />
      </section>
      <section className="demo-sidebar-section" aria-label="Event log">
        <div className="demo-section-head">
          <div>
            <div className="demo-eyebrow">OPERATOR STREAM</div>
            <div className="demo-section-kicker">runtime, vault, chain events</div>
          </div>
          <span className="demo-section-index">02</span>
        </div>
        <EventLog />
      </section>
    </aside>
  );
}
