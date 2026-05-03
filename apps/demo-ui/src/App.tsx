import { AmbientBackground } from './components/shell/AmbientBackground.js';
import { Sidebar } from './components/shell/Sidebar.js';
import { ConnectionBadge } from './components/shell/ConnectionBadge.js';
import { TransportToggle } from './components/shell/TransportToggle.js';
import { ChainBadge } from './components/shell/ChainBadge.js';
import { Canvas } from './components/canvas/Canvas.js';

/**
 * App — two regions:
 *   - <AmbientBackground/> fixed behind everything (z-0, decorative)
 *   - <header.demo-topbar/>: connection + transport + chain status
 *   - <main.demo-shell/>: <Sidebar/> (chat — output + input together) + <Canvas/>
 *
 * The chat conversation lives in one column (history + input adjacent) so the
 * user reads and acts in the same field of view; the canvas owns the rest.
 */
export function App(): JSX.Element {
  return (
    <>
      <AmbientBackground />
      <header className="demo-topbar" aria-label="System status">
        <div className="demo-topbar-cluster">
          <ConnectionBadge />
          <TransportToggle />
        </div>
        <div className="demo-topbar-cluster">
          <ChainBadge />
        </div>
      </header>
      <main className="demo-shell" data-testid="demo-ui-root" aria-label="Sonar demo">
        <Sidebar />
        <Canvas />
      </main>
    </>
  );
}
