import { ChatMirror } from '../sidebar/ChatMirror.js';
import { ChatInput } from '../sidebar/ChatInput.js';

/**
 * Sidebar — single section: AGENT RUNTIME (chat history + input). The
 * OPERATOR STREAM (event log) was moved into the canvas footer so the
 * telemetry sits adjacent to the runtimes it describes.
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
    </aside>
  );
}
