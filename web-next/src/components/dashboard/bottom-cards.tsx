"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  CreditCard,
  Target,
  Zap,
  Gauge,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, statusColor } from "@/lib/format";
import type { LimiteCategoria, Cartao, MetaFinanceira } from "@/lib/api";

interface AlertsCardProps {
  limitesAlerta: LimiteCategoria[];
}

export function AlertsCard({ limitesAlerta }: AlertsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="card-premium p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="section-header">
          <div className="section-header-icon bg-gradient-to-br from-amber-500/10 to-amber-500/20 text-amber-600 dark:text-amber-400">
            <Zap className="h-4.5 w-4.5" />
          </div>
          <h3 className="text-sm font-bold tracking-tight">Alertas</h3>
        </div>
      </div>
      {limitesAlerta.length > 0 ? (
        <div className="space-y-3">
          {limitesAlerta.slice(0, 4).map((l) => (
            <div key={l.id} className="flex items-center gap-3 rounded-xl bg-muted/20 p-3.5 border border-border/20 transition-all duration-300 hover:bg-muted/40 hover:border-border/40">
              <Gauge className={`h-4 w-4 shrink-0 ${
                l.status === "excedido" || l.status === "critico" ? "text-red-500" : "text-amber-500"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate">{l.categoriaNome}</p>
                <p className="text-[11px] text-muted-foreground/60 font-medium">
                  {formatCurrency(l.gastoAtual)} de {formatCurrency(l.valorLimite)}
                </p>
              </div>
              <Badge variant="secondary" className={statusColor(l.status).badge}>
                {l.percentualConsumido.toFixed(0)}%
              </Badge>
            </div>
          ))}
          <Link href="/limites">
            <Button variant="ghost" size="sm" className="w-full text-xs gap-1 text-primary hover:text-primary font-semibold mt-1">
              Ver limites <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-500/12 mb-3 shadow-sm">
            <Sparkles className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm font-bold">Tudo em ordem!</p>
          <p className="text-[11px] text-muted-foreground/60 mt-1 font-medium">Nenhum limite ultrapassado</p>
        </div>
      )}
    </motion.div>
  );
}

interface CardsOverviewCardProps {
  cartoes: Cartao[];
}

export function CardsOverviewCard({ cartoes }: CardsOverviewCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="card-premium p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="section-header">
          <div className="section-header-icon bg-gradient-to-br from-violet-500/10 to-violet-500/20 text-violet-600 dark:text-violet-400">
            <CreditCard className="h-4.5 w-4.5" />
          </div>
          <h3 className="text-sm font-bold tracking-tight">Cartões</h3>
        </div>
        <Link href="/cartoes">
          <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs text-primary hover:text-primary font-semibold">
            Gerenciar <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>
      {cartoes.length > 0 ? (
        <div className="space-y-3">
          {cartoes.slice(0, 3).map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl bg-muted/20 p-3.5 border border-border/20 transition-all duration-300 hover:bg-muted/40 hover:border-border/40 group">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-card-purple text-white shadow-md shadow-violet-500/20 transition-transform duration-300 group-hover:scale-105">
                <CreditCard className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate">{c.nome}</p>
                <p className="text-[11px] text-muted-foreground/60 font-medium">Venc. dia {c.diaVencimento}</p>
              </div>
              <p className="text-sm font-bold tabular-nums">{formatCurrency(c.limite)}</p>
            </div>
          ))}
          {cartoes.length > 3 && (
            <p className="text-[11px] text-muted-foreground/60 text-center font-medium">+{cartoes.length - 3} cartões</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 mb-3 shadow-sm">
            <CreditCard className="h-6 w-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-bold">Nenhum cartão</p>
          <p className="text-[11px] text-muted-foreground/60 mt-1 font-medium">Adicione na aba Cartões</p>
        </div>
      )}
    </motion.div>
  );
}

interface ActiveMetasCardProps {
  metasAtivas: MetaFinanceira[];
}

export function ActiveMetasCard({ metasAtivas }: ActiveMetasCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="card-premium p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="section-header">
          <div className="section-header-icon bg-gradient-to-br from-cyan-500/10 to-cyan-500/20 text-cyan-600 dark:text-cyan-400">
            <Target className="h-4.5 w-4.5" />
          </div>
          <h3 className="text-sm font-bold tracking-tight">Metas Ativas</h3>
        </div>
        <Link href="/metas">
          <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs text-primary hover:text-primary font-semibold">
            Ver todas <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>
      {metasAtivas.length > 0 ? (
        <div className="space-y-4">
          {metasAtivas.slice(0, 3).map((meta) => (
            <div key={meta.id} className="space-y-2.5 rounded-xl bg-muted/20 p-3.5 border border-border/20 transition-all duration-300 hover:bg-muted/40 hover:border-border/40">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold truncate">{meta.nome}</p>
                <span className="text-xs font-extrabold tabular-nums text-primary">{meta.percentualConcluido.toFixed(0)}%</span>
              </div>
              <Progress value={Math.min(meta.percentualConcluido, 100)} className="h-2" />
              <p className="text-[11px] text-muted-foreground/60 tabular-nums font-medium">
                {formatCurrency(meta.valorAtual)} de {formatCurrency(meta.valorAlvo)}
              </p>
            </div>
          ))}
          {metasAtivas.length > 3 && (
            <p className="text-[11px] text-muted-foreground/60 text-center font-medium">
              +{metasAtivas.length - 3} metas ativas
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 mb-3 shadow-sm">
            <Target className="h-6 w-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-bold">Sem metas ativas</p>
          <Link href="/metas">
            <Button variant="ghost" size="sm" className="text-xs text-primary mt-1.5 hover:text-primary font-semibold">
              Criar meta
            </Button>
          </Link>
        </div>
      )}
    </motion.div>
  );
}
