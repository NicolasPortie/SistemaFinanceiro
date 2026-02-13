"use client";

import { LottieAnimation } from "@/components/shared/lottie-animation";
import { loadingCoins } from "@/assets/lottie";

export default function GlobalLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <LottieAnimation animationData={loadingCoins} size="md" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando...</p>
      </div>
    </div>
  );
}
