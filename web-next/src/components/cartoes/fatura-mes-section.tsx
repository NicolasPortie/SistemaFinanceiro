"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { api, type Cartao, type FaturaParcela } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Receipt, ShoppingCart, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

// ── Category badge colors ──────────────────────────────────
const categoryBadgeColors: Record<string, string> = {
  Alimentação: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  Transporte: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  Moradia: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  Lazer: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400",
  Saúde: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  Educação: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400",
  Salário: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  Roupas: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  Compras: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  Eletrônicos: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400",
  Outros: "bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-400",
};
const defaultBadge = "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400";

const categoryIconBg: Record<string, string> = {
  Alimentação: "bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400",
  Transporte: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  Moradia: "bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400",
  Lazer: "bg-pink-100 dark:bg-pink-500/15 text-pink-600 dark:text-pink-400",
  Saúde: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  Educação: "bg-cyan-100 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  Roupas: "bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400",
  Compras: "bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400",
  Eletrônicos: "bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400",
};
const defaultIconBg = "bg-slate-100 dark:bg-slate-500/15 text-slate-500 dark:text-slate-400";

interface CombinedParcela extends FaturaParcela {
  cartaoNome: string;
}

interface FaturaMesSectionProps {
  cartoes: Cartao[];
  mesParam: string;
  mesLabel: string;
}

export function FaturaMesSection({ cartoes, mesParam, mesLabel }: FaturaMesSectionProps) {
  const [showAll, setShowAll] = useState(false);

  // Fetch faturas for all cards in parallel
  const faturaQueries = useQueries({
    queries: cartoes.map((c) => ({
      queryKey: ["fatura", c.id, mesParam] as const,
      queryFn: () => api.cartoes.faturas(c.id, mesParam),
      staleTime: 2 * 60 * 1000,
      retry: false,
    })),
  });

  const isLoading = faturaQueries.some((q) => q.isLoading);

  const { parcelas, totalAPagar, proximoVencimento } = useMemo(() => {
    const combined: CombinedParcela[] = [];
    let total = 0;
    let earliestVenc: Date | null = null;

    faturaQueries.forEach((q, i) => {
      if (!q.data) return;
      // Take the first fatura per card (current/next month)
      const fatura = q.data[0];
      if (!fatura) return;

      for (const p of fatura.parcelas) {
        combined.push({
          ...p,
          cartaoNome: cartoes[i].nome,
        });
      }
      total += fatura.total;

      const vencDate = new Date(fatura.dataVencimento);
      if (!earliestVenc || vencDate < earliestVenc) {
        earliestVenc = vencDate;
      }
    });

    combined.sort((a, b) => new Date(b.dataCompra).getTime() - new Date(a.dataCompra).getTime());

    return {
      parcelas: combined,
      totalAPagar: total,
      proximoVencimento: earliestVenc,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faturaQueries.map((q) => q.dataUpdatedAt).join(","), cartoes]);

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-panel rounded-2xl p-10 flex items-center justify-center"
      >
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </motion.div>
    );
  }

  if (parcelas.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-panel rounded-2xl p-8 flex flex-col items-center justify-center gap-3"
      >
        <div className="size-12 flex items-center justify-center bg-slate-100 dark:bg-slate-700/50 rounded-xl">
          <Receipt className="h-6 w-6 text-slate-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Nenhuma fatura em {mesLabel}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Não há lançamentos no cartão para este mês
          </p>
        </div>
      </motion.div>
    );
  }

  const formatVenc = (date: Date | null) => {
    if (!date) return "";
    return date
      .toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
      .toUpperCase()
      .replace(".", "");
  };

  const formatShort = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    });

  const visibleParcelas = showAll ? parcelas : parcelas.slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass-panel rounded-2xl overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="p-5 lg:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/30">
        <div className="flex items-center gap-3">
          <div className="size-10 flex items-center justify-center bg-emerald-600/10 rounded-xl">
            <Receipt className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">
              Fatura de {mesLabel}
            </h3>
            {proximoVencimento && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                Próximo vencimento:{" "}
                <span className="font-semibold text-red-500">{formatVenc(proximoVencimento)}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">
              Total a Pagar
            </p>
            <p className="text-xl font-bold text-slate-800 dark:text-white tracking-tight tabular-nums">
              {formatCurrency(totalAPagar)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700/30">
              <th className="text-left text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium pl-5 lg:pl-6 pr-2 py-3 w-10" />
              <th className="text-left text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium px-3 py-3">
                Descrição
              </th>
              <th className="text-left text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium px-3 py-3 hidden sm:table-cell">
                Data
              </th>
              <th className="text-left text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium px-3 py-3 hidden md:table-cell">
                Categoria
              </th>
              <th className="text-center text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium px-3 py-3 hidden lg:table-cell">
                Parcelas
              </th>
              <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium pr-5 lg:pr-6 pl-3 py-3">
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleParcelas.map((p, i) => {
              const iconCls = categoryIconBg[p.categoria] || defaultIconBg;
              const badgeCls = categoryBadgeColors[p.categoria] || defaultBadge;

              return (
                <tr
                  key={`${p.descricao}-${p.dataCompra}-${i}`}
                  className="border-b border-slate-50 dark:border-slate-700/20 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-700/10 transition-colors"
                >
                  {/* Icon */}
                  <td className="pl-5 lg:pl-6 pr-2 py-3.5">
                    <div
                      className={cn(
                        "size-9 rounded-xl flex items-center justify-center shrink-0",
                        iconCls
                      )}
                    >
                      <ShoppingCart className="h-4 w-4" />
                    </div>
                  </td>

                  {/* Descrição + card nome */}
                  <td className="px-3 py-3.5">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white truncate max-w-55">
                      {p.descricao}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">{p.cartaoNome}</p>
                  </td>

                  {/* Data */}
                  <td className="px-3 py-3.5 hidden sm:table-cell">
                    <span className="text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {formatShort(p.dataCompra)}
                    </span>
                  </td>

                  {/* Categoria badge */}
                  <td className="px-3 py-3.5 hidden md:table-cell">
                    {p.categoria && (
                      <span
                        className={cn(
                          "text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap",
                          badgeCls
                        )}
                      >
                        {p.categoria}
                      </span>
                    )}
                  </td>

                  {/* Parcelas */}
                  <td className="px-3 py-3.5 text-center hidden lg:table-cell">
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      {p.numeroParcela}/{p.totalParcelas}
                    </span>
                  </td>

                  {/* Valor */}
                  <td className="pr-5 lg:pr-6 pl-3 py-3.5 text-right">
                    <span className="text-sm font-bold text-slate-800 dark:text-white tabular-nums">
                      {formatCurrency(p.valor)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Footer / expand toggle ── */}
      {parcelas.length > 6 && (
        <div className="border-t border-slate-100 dark:border-slate-700/30 px-5 lg:px-6 py-3 text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-emerald-600 font-semibold cursor-pointer hover:underline inline-flex items-center gap-1"
          >
            {showAll ? (
              <>
                Mostrar menos <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Ver todas as {parcelas.length} transações da fatura{" "}
                <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      )}
    </motion.div>
  );
}
