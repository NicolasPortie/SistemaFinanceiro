// ============================================================
// ControlFinance — Lottie Animation Wrapper
// Componente padrão para todas as animações Lottie do sistema
// Respeita prefers-reduced-motion para acessibilidade
// ============================================================
"use client";

import { useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import type { LottieComponentProps } from "lottie-react";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

const sizeMap = {
  xs: 80,
  sm: 120,
  md: 200,
  lg: 280,
  xl: 400,
};

interface LottieAnimationProps extends Omit<Partial<LottieComponentProps>, "size"> {
  animationData: object;
  className?: string;
  size?: keyof typeof sizeMap;
  loop?: boolean;
}

export function LottieAnimation({
  animationData,
  className,
  size = "md",
  loop = true,
  ...props
}: LottieAnimationProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className} style={{ width: sizeMap[size], height: sizeMap[size] }} />;
  }

  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      style={{ width: sizeMap[size], height: sizeMap[size] }}
      className={className}
      {...props}
    />
  );
}
