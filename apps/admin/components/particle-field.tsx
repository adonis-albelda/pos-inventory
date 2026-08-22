/** Deterministic scatter (index run through a modulo, not Math.random()) —
 * same particle field every render, no hydration-mismatch risk, still reads
 * as organic since 97 and 100 share no factors. Shared by every auth screen
 * so the drifting-dot background reads as one visual system across them. */
const PARTICLES = Array.from({ length: 48 }, (_, i) => ({
  left: (i * 97) % 100,
  size: 3 + (i % 4),
  duration: 6 + (i % 7),
  delay: -((i * 3) % 10),
}));

export function ParticleField({ color }: { color: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden motion-safe:block">
      {PARTICLES.map((particle, index) => (
        <span
          key={index}
          style={{
            position: "absolute",
            left: `${particle.left}%`,
            bottom: -20,
            width: particle.size,
            height: particle.size,
            borderRadius: 9999,
            backgroundColor: color,
            opacity: 0,
            animationName: "particle-float",
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`,
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
          }}
        />
      ))}
    </div>
  );
}
