import { AmbientBackground } from './components/shell/AmbientBackground.js';
import { Sidebar } from './components/shell/Sidebar.js';
import { ActionBar } from './components/shell/ActionBar.js';
import { ConnectionBadge } from './components/shell/ConnectionBadge.js';
import { TransportToggle } from './components/shell/TransportToggle.js';
import { Canvas } from './components/canvas/Canvas.js';

/**
 * App — three regions:
 *   - <AmbientBackground/> fixed behind everything (z-0, decorative)
 *   - <main.demo-shell> with <Sidebar/> + <Canvas/> (4 runtimes + 3 services + edge pulses)
 *   - <ActionBar/> (full-width prompt + rotation status + latest deprecation)
 */
export function App(): JSX.Element {
  return (
    <>
      <AmbientBackground />
      <header className="demo-topbar" aria-label="Connection status">
        <ConnectionBadge />
        <TransportToggle />
      </header>
      <main className="demo-shell" data-testid="demo-ui-root" aria-label="Sonar demo">
        <Sidebar />
        <Canvas />
      </main>
      <ActionBar />
    </>
  );
}
