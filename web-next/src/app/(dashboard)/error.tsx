"use client";

import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LottieAnimation } from "@/components/shared/lottie-animation";
import { errorWarning } from "@/assets/lottie";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center text-center max-w-sm space-y-5"
      >
        <LottieAnimation animationData={errorWarning} size="sm" />
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold">Erro ao carregar</h2>
          <p className="text-sm text-muted-foreground">
            {error.message || "Ocorreu um erro inesperado."}
          </p>
        </div>
        <Button onClick={reset} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </motion.div>
    </div>
  );
}
