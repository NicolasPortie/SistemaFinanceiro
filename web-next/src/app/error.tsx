"use client";

import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LottieAnimation } from "@/components/shared/lottie-animation";
import { errorBroken } from "@/assets/lottie";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center max-w-md space-y-6"
      >
        <LottieAnimation animationData={errorBroken} size="lg" loop={false} />

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Algo deu errado</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Ocorreu um erro inesperado. Nossa equipe foi notificada e estamos trabalhando na
            correção.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground/60 font-mono">Código: {error.digest}</p>
          )}
        </div>

        <Button onClick={reset} className="gap-2 h-11 font-semibold">
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </motion.div>
    </div>
  );
}
