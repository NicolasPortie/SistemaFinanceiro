"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LottieAnimation } from "@/components/shared/lottie-animation";
import { notFound as notFoundAnim } from "@/assets/lottie";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center text-center max-w-md space-y-6">
        <LottieAnimation animationData={notFoundAnim} size="lg" />

        <div className="space-y-2">
          <p className="text-6xl font-black text-primary tabular-nums">404</p>
          <h1 className="text-2xl font-bold tracking-tight">Página não encontrada</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            A página que você está procurando não existe ou foi movida para outro endereço.
          </p>
        </div>

        <Link href="/dashboard">
          <Button className="gap-2 h-11 font-semibold">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
