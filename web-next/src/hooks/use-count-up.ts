"use client";

import { useEffect, useRef, useState } from "react";

interface UseCountUpOptions {
  /** Target value to animate to */
  end: number;
  /** Animation duration in ms (default: 1200) */
  duration?: number;
  /** Decimal places (default: 2 for currency) */
  decimals?: number;
  /** Only animate when element is in viewport (default: true) */
  startOnView?: boolean;
  /** Easing function (default: easeOutExpo) */
  easing?: "easeOutExpo" | "easeOutCubic" | "linear";
}

function easings(t: number, type: string): number {
  switch (type) {
    case "easeOutExpo":
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    case "easeOutCubic":
      return 1 - Math.pow(1 - t, 3);
    default:
      return t;
  }
}

export function useCountUp({
  end,
  duration = 1200,
  decimals = 2,
  startOnView = true,
  easing = "easeOutExpo",
}: UseCountUpOptions) {
  const [value, setValue] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const frameRef = useRef<number>(0);
  const prevEnd = useRef(end);

  useEffect(() => {
    if (!startOnView) {
      setHasStarted(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [startOnView]);

  useEffect(() => {
    if (!hasStarted) return;

    const startVal = prevEnd.current !== end ? prevEnd.current : 0;
    prevEnd.current = end;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easings(progress, easing);
      const current = startVal + (end - startVal) * easedProgress;

      setValue(Number(current.toFixed(decimals)));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [end, duration, decimals, easing, hasStarted]);

  return { value, ref };
}
