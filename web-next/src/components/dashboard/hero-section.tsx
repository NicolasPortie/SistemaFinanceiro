"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  MessageCircle,
  RefreshCw,
  Plus,
  ShoppingCart,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getGreeting, getFirstName } from "@/lib/format";
import type { Usuario } from "@/lib/api";

interface HeroSectionProps {
  usuario: Usuario | null;
  healthLabel: string | null;
  saldo: number;
  totalReceitas: number;
  totalGastos: number;
  loading: boolean;
  onRefresh: () => void;
}

export function HeroSection({ usuario, healthLabel, saldo, totalReceitas, totalGastos, loading, onRefresh }: HeroSectionProps) {
  const comprometimento = totalReceitas > 0 ? Math.round((totalGastos / totalReceitas) * 100) : null;
  const resultadoLabel = saldo > 0 ? "Sobrou" : saldo < 0 ? "Faltou" : "Equilibrado";
  const absValue = Math.abs(saldo);
  const formatBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl p-6 sm:p-8 lg:p-10 text-white"
    >
      <div className="absolute inset-0 gradient-hero dark:gradient-hero-dark" />
      <div className="absolute inset-0 bg-linear-to-t from-black/15 to-transparent" />
      <div className="absolute inset-0 bg-linear-to-r from-black/5 to-transparent" />

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/2.5 animate-float" />
        <div className="absolute right-32 top-10 h-20 w-20 rounded-full bg-white/2" style={{ animationDelay: "2s" }} />
        <div className="absolute -left-10 -bottom-10 h-52 w-52 rounded-full bg-white/2.5 animate-float" style={{ animationDelay: "4s" }} />
        <div className="absolute left-1/3 bottom-6 h-10 w-10 rounded-full bg-white/1.5" />
        <div className="absolute top-0 right-1/4 w-px h-full bg-linear-to-b from-transparent via-white/6 to-transparent" />
        <div className="absolute bottom-0 left-1/3 w-32 h-px bg-linear-to-r from-transparent via-white/6 to-transparent" />
      </div>

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">
              {getGreeting()}, {getFirstName(usuario?.nome ?? "")}
            </h1>
            {usuario?.telegramVinculado && (
              <Badge className="bg-white/12 text-white border-0 text-[10px] gap-1 hidden sm:flex backdrop-blur-sm font-semibold">
                <MessageCircle className="h-3 w-3" />
                Bot ativo
              </Badge>
            )}
          </div>
          <p className="text-white/45 text-sm max-w-md leading-relaxed">
            {healthLabel
              ? <>
                Saúde financeira:{" "}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-white/90 font-semibold cursor-help border-b border-dashed border-white/30">
                        {healthLabel}
                        <Info className="inline h-3 w-3 ml-1 opacity-50" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-65 text-xs leading-relaxed">
                      Baseado na % da renda que você consegue poupar: Excelente (≥30%), Boa (≥15%), Regular (≥5%), Apertada (&lt;5%), Crítica (gastando mais do que ganha).
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {" · "}
                <span className="text-white/95 font-bold">{resultadoLabel}</span>
                {saldo !== 0 && (
                  <> de <span className="text-white/95 font-bold">{formatBRL(absValue)}</span></>
                )}
                {comprometimento !== null && (
                  <> {" · "}Você gastou{" "}
                    <span className="text-white/95 font-bold">{comprometimento}%</span>
                    {" "}da receita
                  </>
                )}
              </>
              : "Aqui está o resumo das suas finanças"
            }
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link href="/lancamentos">
            <Button size="sm" className="bg-white/12 hover:bg-white/20 text-white border border-white/10 gap-1.5 h-10 backdrop-blur-md shadow-lg shadow-black/8 font-semibold transition-all duration-300 rounded-xl hover:-translate-y-px">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lançamento</span>
            </Button>
          </Link>
          <Link href="/simulacao">
            <Button size="sm" className="bg-white/12 hover:bg-white/20 text-white border border-white/10 gap-1.5 h-10 backdrop-blur-md shadow-lg shadow-black/8 font-semibold transition-all duration-300 rounded-xl hover:-translate-y-px">
              <ShoppingCart className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Simular</span>
            </Button>
          </Link>
          <Button
            size="sm"
            className="bg-white/12 hover:bg-white/20 text-white border border-white/10 h-10 w-10 p-0 backdrop-blur-md shadow-lg shadow-black/8 transition-all duration-300 rounded-xl hover:-translate-y-px"
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
