"use client";

import { LottieAnimation } from "@/components/shared/lottie-animation";
import { loadingChart } from "@/assets/lottie";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <LottieAnimation animationData={loadingChart} size="sm" />
        <p className="text-sm text-muted-foreground">Carregando dados...</p>
      </div>
    </div>
  );
}
