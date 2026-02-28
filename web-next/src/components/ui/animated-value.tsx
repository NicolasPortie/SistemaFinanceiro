"use client";

import { useCountUp } from "@/hooks/use-count-up";

interface AnimatedCurrencyProps {
  /** Numeric value to display */
  value: number;
  /** Duration of animation in ms */
  duration?: number;
  /** Additional CSS classes */
  className?: string;
  /** Show + sign for positive values */
  showSign?: boolean;
  /** Prefix (default: "R$ ") */
  prefix?: string;
}

export function AnimatedCurrency({
  value: targetValue,
  duration = 1400,
  className,
  showSign = false,
  prefix = "R$ ",
}: AnimatedCurrencyProps) {
  const { value, ref } = useCountUp({
    end: targetValue,
    duration,
    decimals: 2,
  });

  const formatted = value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const sign = showSign && targetValue > 0 ? "+" : "";

  return (
    <span ref={ref as React.Ref<HTMLSpanElement>} className={className}>
      {sign}
      {prefix}
      {formatted}
    </span>
  );
}

interface AnimatedPercentProps {
  /** Numeric percent value (e.g. 85 for 85%) */
  value: number;
  /** Duration of animation in ms */
  duration?: number;
  /** Additional CSS classes */
  className?: string;
  /** Decimal places (default: 1) */
  decimals?: number;
}

export function AnimatedPercent({
  value: targetValue,
  duration = 1200,
  className,
  decimals = 1,
}: AnimatedPercentProps) {
  const { value, ref } = useCountUp({
    end: targetValue,
    duration,
    decimals,
  });

  return (
    <span ref={ref as React.Ref<HTMLSpanElement>} className={className}>
      {value.toLocaleString("pt-BR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      %
    </span>
  );
}
