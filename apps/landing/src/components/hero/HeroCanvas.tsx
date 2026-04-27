/**
 * STUB — plan 03 replaces this with the real R3F Canvas (autonomous
 * ping/echo loop, ortho camera, three runtime nodes).
 *
 * Until then, render the same SVG silhouette as the Suspense fallback so
 * the canvas slot stays visually identical (no CLS, no flash) once the
 * lazy chunk resolves.
 */
import { HeroFallback } from "./HeroFallback";

export default function HeroCanvas() {
  return <HeroFallback />;
}
