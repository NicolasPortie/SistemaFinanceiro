"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  MessageCircle,
  RefreshCw,
  Plus,
  ShoppingCart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getGreeting, getFirstName } from "@/lib/format";
import type { Usuario } from "@/lib/api";

interface HeroSectionProps {
  usuario: Usuario | null;
  healthLabel: string | null;
  taxaEconomia: number;
  loading: boolean;
  onRefresh: () => void;
}

export function HeroSection({ usuario, healthLabel, taxaEconomia, loading, onRefresh }: HeroSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white noise-overlay"
    >
      <div className="absolute inset-0 gradient-hero dark:gradient-hero-dark" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/5 to-transparent" />

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -right-10 -top-10 h-52 w-52 rounded-full bg-white/[0.04] animate-float" />
        <div className="absolute right-24 top-6 h-20 w-20 rounded-full bg-white/[0.03]" style={{ animationDelay: "2s" }} />
        <div className="absolute -left-6 -bottom-6 h-40 w-40 rounded-full bg-white/[0.04] animate-float" style={{ animationDelay: "4s" }} />
        <div className="absolute left-1/3 bottom-3 h-10 w-10 rounded-full bg-white/[0.03]" />
        <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
        <div className="absolute bottom-0 left-1/3 w-32 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {getGreeting()}, {getFirstName(usuario?.nome ?? "")}
            </h1>
            {usuario?.telegramVinculado && (
              <Badge className="bg-white/15 text-white border-0 text-[10px] gap-1 hidden sm:flex backdrop-blur-sm font-semibold">
                <MessageCircle className="h-3 w-3" />
                Bot ativo
              </Badge>
            )}
          </div>
          <p className="text-white/60 text-sm max-w-md leading-relaxed">
            {healthLabel
              ? <>
                  Saúde financeira:{" "}
                  <span className="text-white/90 font-semibold">{healthLabel}</span>
                  {" · "}Economia de{" "}
                  <span className="text-white font-bold">{taxaEconomia}%</span>
                  {" "}este mês
                </>
              : "Aqui está o resumo das suas finanças"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/lancamentos">
            <Button size="sm" className="bg-white/12 hover:bg-white/20 text-white border border-white/10 gap-1.5 h-9 backdrop-blur-md shadow-lg shadow-black/10 font-semibold transition-all duration-300">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lançamento</span>
            </Button>
          </Link>
          <Link href="/simulacao">
            <Button size="sm" className="bg-white/12 hover:bg-white/20 text-white border border-white/10 gap-1.5 h-9 backdrop-blur-md shadow-lg shadow-black/10 font-semibold transition-all duration-300">
              <ShoppingCart className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Simular</span>
            </Button>
          </Link>
          <Button
            size="sm"
            className="bg-white/12 hover:bg-white/20 text-white border border-white/10 h-9 w-9 p-0 backdrop-blur-md shadow-lg shadow-black/10 transition-all duration-300"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Atualizar dados"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
