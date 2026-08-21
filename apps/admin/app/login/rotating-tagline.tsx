"use client";

import { useEffect, useState } from "react";

const ROTATE_MS = 4000;

/** Cycles through the given lines, fading/lifting in the next one — `key={index}` is what
 * restarts the CSS animation on every change, same trick as a toast remounting to replay. */
export function RotatingTagline({ lines }: { lines: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (lines.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % lines.length);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [lines.length]);

  return (
    <h2
      key={index}
      className="motion-safe:animate-tagline-in text-heading-lg font-bold leading-tight text-white"
    >
      {lines[index]}
    </h2>
  );
}
