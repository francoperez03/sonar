import { AmbientBackground } from "./components/shell/AmbientBackground.js";
import { Sidebar } from "./components/shell/Sidebar.js";
import { Footer } from "./components/shell/Footer.js";
import { ConnectionBadge } from "./components/shell/ConnectionBadge.js";
import { Canvas } from "./components/canvas/Canvas.js";

/**
 * App — three regions:
 *   - <AmbientBackground/> fixed behind everything (z-0, decorative)
 *   - <main.demo-shell> with <Sidebar/> + <Canvas/> (4 runtimes + 3 services + edge pulses)
 *   - <Footer/> (tx hash + Run again CTA)
 */
export function App(): JSX.Element {
  return (
    <>
      <AmbientBackground />
      <header className="demo-topbar" aria-label="Connection status">
        <ConnectionBadge />
      </header>
      <main className="demo-shell" data-testid="demo-ui-root" aria-label="Sonar demo">
        <Sidebar />
        <Canvas />
      </main>
      <Footer />
    </>
  );
}
