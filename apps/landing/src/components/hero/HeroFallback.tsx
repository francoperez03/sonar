/**
 * Static SVG silhouette of the live R3F sonar scope. Occupies the canvas
 * slot while HeroCanvas (plan 03) lazy-loads, preventing CLS on swap
 * (Pitfall 5). Node positions roughly project the alpha/beta/gamma
 * positions from RESEARCH §Pattern 3 NODES array onto 2D.
 */
export function HeroFallback() {
  return (
    <svg
      viewBox="0 0 400 225"
      preserveAspectRatio="xMidYMid meet"
      aria-label="Sonar scope (loading)"
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <circle
        cx="200"
        cy="112"
        r="60"
        fill="none"
        stroke="var(--color-accent-cyan)"
        strokeOpacity="0.6"
        strokeWidth="1.5"
      />
      <circle
        cx="200"
        cy="112"
        r="92"
        fill="none"
        stroke="var(--color-accent-cyan)"
        strokeOpacity="0.18"
        strokeWidth="1"
      />
      {/* alpha node — left, slightly upper */}
      <circle
        cx="100"
        cy="146"
        r="6"
        fill="var(--color-surface)"
        stroke="var(--color-border)"
      />
      {/* beta node — right */}
      <circle
        cx="312"
        cy="101"
        r="6"
        fill="var(--color-surface)"
        stroke="var(--color-border)"
      />
      {/* gamma node — lower-mid */}
      <circle
        cx="220"
        cy="191"
        r="6"
        fill="var(--color-surface)"
        stroke="var(--color-border)"
      />
    </svg>
  );
}
