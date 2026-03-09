"use client";

import { useState, useMemo } from "react";
import { FileText, CheckCircle2, XCircle, AlertCircle, CreditCard, Building2, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useImportacaoHistorico } from "@/hooks/use-queries";
import type { ImportacaoHistorico as HistoricoItem, StatusImportacao, TipoImportacao } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

const INITIAL_VISIBLE = 5;

const STATUS_DOT: Record<StatusImportacao, { bg: string; label: string }> = {
  Processado: { bg: "bg-amber-400", label: "Processado" },
  Confirmado: { bg: "bg-emerald-500", label: "Confirmado" },
  Falhou: { bg: "bg-red-500", label: "Falhou" },
};

const TIPO_ICON: Record<TipoImportacao, React.ElementType> = {
  Extrato: Building2,
  Fatura: CreditCard,
};

const TIPO_SHORT: Record<TipoImportacao, string> = {
  Extrato: "Extrato",
  Fatura: "Fatura",
};

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays}d atrás`;

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function groupByMonth(items: HistoricoItem[]): Map<string, HistoricoItem[]> {
  const groups = new Map<string, HistoricoItem[]>();
  for (const item of items) {
    const d = new Date(item.criadoEm);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return groups;
}

function formatMonthLabel(key: string): string {
  const [year, month] = key.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function HistoricoImportacao() {
  const { data: historico, isLoading, error } = useImportacaoHistorico();
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(
    () => [...(historico ?? [])].sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()),
    [historico]
  );

  const totalImportadas = useMemo(
    () => sorted.reduce((acc, h) => acc + h.qtdTransacoesImportadas, 0),
    [sorted]
  );

  const visible = showAll ? sorted : sorted.slice(0, INITIAL_VISIBLE);
  const grouped = useMemo(() => groupByMonth(visible), [visible]);
  const hasMore = sorted.length > INITIAL_VISIBLE;

  if (isLoading) {
    return (
      <div className="px-5 sm:px-8 py-5 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive px-5 sm:px-8 py-6">
        <AlertCircle className="h-4 w-4" />
        Erro ao carregar histórico
      </div>
    );
  }

  if (!historico || historico.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <FileText className="h-8 w-8 opacity-20" />
        <p className="text-xs font-medium">Nenhuma importação realizada</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary strip */}
      <div className="px-5 sm:px-8 py-3 flex items-center gap-6 border-b border-slate-50 dark:border-slate-800/50">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-slate-900 dark:text-white">{sorted.length}</span>
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">importações</span>
        </div>
        <div className="w-px h-5 bg-slate-100 dark:bg-slate-800" />
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{totalImportadas}</span>
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">transações</span>
        </div>
      </div>

      {/* Timeline grouped by month */}
      <div className="px-5 sm:px-8 py-4">
        {Array.from(grouped.entries()).map(([monthKey, items], gi) => (
          <div key={monthKey} className={cn(gi > 0 && "mt-5")}>
            {/* Month label */}
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] mb-2.5">
              {formatMonthLabel(monthKey)}
            </p>

            {/* Items */}
            <div className="space-y-1">
              {items.map((item, i) => {
                const statusCfg = STATUS_DOT[item.status];
                const TipoIcon = TIPO_ICON[item.tipoImportacao];
                const pct = item.qtdTransacoesEncontradas > 0
                  ? Math.round((item.qtdTransacoesImportadas / item.qtdTransacoesEncontradas) * 100)
                  : 0;

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (gi * items.length + i) * 0.03 }}
                    className="group flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Status dot + type icon */}
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <TipoIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      </div>
                      <span
                        className={cn("absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-[#161B22]", statusCfg.bg)}
                        title={statusCfg.label}
                      />
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {item.bancoDetectado || item.nomeArquivo}
                        </p>
                        <span className="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-wider shrink-0">
                          {TIPO_SHORT[item.tipoImportacao]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400">
                          {item.qtdTransacoesImportadas} de {item.qtdTransacoesEncontradas}
                        </span>
                        {/* Mini progress bar */}
                        <div className="w-12 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              item.status === "Falhou" ? "bg-red-400" : "bg-emerald-400"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Date + status icon */}
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] text-slate-400 font-medium">{formatRelativeDate(item.criadoEm)}</p>
                      {item.status === "Falhou" && (
                        <XCircle className="w-3 h-3 text-red-400 inline-block mt-0.5" />
                      )}
                      {item.status === "Confirmado" && (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 inline-block mt-0.5" />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Show more / less */}
        {hasMore && (
          <AnimatePresence>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setShowAll(!showAll)}
              className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
            >
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showAll && "rotate-180")} />
              {showAll ? "Mostrar menos" : `Ver todas (${sorted.length})`}
            </motion.button>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
