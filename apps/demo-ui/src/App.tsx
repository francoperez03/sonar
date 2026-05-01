import { AmbientBackground } from "./components/shell/AmbientBackground.js";
import { Sidebar } from "./components/shell/Sidebar.js";
import { Footer } from "./components/shell/Footer.js";

/**
 * App — three regions:
 *   - <AmbientBackground/> fixed behind everything (z-0, decorative)
 *   - <main.demo-shell> with <Sidebar/> + canvas placeholder (plan 06-05 fills it)
 *   - <Footer/> (tx hash + Run again CTA)
 */
export function App(): JSX.Element {
  return (
    <>
      <AmbientBackground />
      <main className="demo-shell" data-testid="demo-ui-root" aria-label="Sonar demo">
        <Sidebar />
        <section
          className="demo-canvas-slot"
          data-testid="canvas-slot"
          aria-label="Canvas (rendered by plan 05)"
        />
      </main>
      <Footer />
    </>
  );
}
