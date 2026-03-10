"use client";

import { useState } from "react";
import { useLimites, useCategorias, useDefinirLimite, useRemoverLimite } from "@/hooks/use-queries";
import { formatCurrency } from "@/lib/format";
import { limiteSchema, type LimiteData } from "@/lib/schemas";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Gauge,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import { EmptyState, ErrorState, CardSkeleton } from "@/components/shared/page-components";
import { DialogShellHeader } from "@/components/shared/dialog-shell";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/* ────────────────────────────────────────────── */
/* Helpers                                         */
/* ────────────────────────────────────────────── */

function statusIcon(status: string) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    case "atencao":
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case "critico":
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    case "excedido":
      return <XCircle className="h-5 w-5 text-red-600" />;
    default:
      return <Gauge className="h-5 w-5 text-slate-400" />;
  }
}

function statusLabel(status: string, compact = false) {
  switch (status) {
    case "ok":
      return compact ? "OK" : "Dentro do limite";
    case "atencao":
      return "Atenção";
    case "critico":
      return "Crítico";
    case "excedido":
      return "Excedido";
    default:
      return status;
  }
}

function statusBgColor(status: string) {
  switch (status) {
    case "ok":
      return "bg-emerald-50 dark:bg-emerald-500/10";
    case "atencao":
      return "bg-amber-50 dark:bg-amber-500/10";
    case "critico":
      return "bg-red-50 dark:bg-red-500/10";
    case "excedido":
      return "bg-red-50 dark:bg-red-500/10";
    default:
      return "bg-slate-50 dark:bg-slate-800/30";
  }
}

function progressColor(status: string) {
  switch (status) {
    case "ok":
      return "bg-emerald-500";
    case "atencao":
      return "bg-amber-500";
    case "critico":
      return "bg-red-500";
    case "excedido":
      return "bg-red-600";
    default:
      return "bg-emerald-600";
  }
}

function statusBadgeCls(status: string) {
  switch (status) {
    case "ok":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
    case "atencao":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800";
    case "critico":
      return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800";
    case "excedido":
      return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800";
    default:
      return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
  }
}

/* ────────────────────────────────────────────── */
/* Page                                            */
/* ────────────────────────────────────────────── */

export default function LimitesPage() {
  const { data: limites = [], isLoading: loading, isError, error, refetch } = useLimites();
  const { data: categorias = [] } = useCategorias();
  const definirLimite = useDefinirLimite();
  const removerLimite = useRemoverLimite();

  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const form = useForm<LimiteData>({
    resolver: zodResolver(limiteSchema),
    defaultValues: { categoria: "", valor: "" },
  });

  const categoriaWatch = form.watch("categoria");
  const valorWatch = form.watch("valor");

  const categoriasDisponiveis = categorias.filter(
    (c) => !limites.find((l) => l.categoriaNome === c.nome)
  );

  const handleSalvar = (data: LimiteData) => {
    const valorNum = parseFloat(data.valor.replace(",", "."));
    definirLimite.mutate(
      { categoria: data.categoria, valor: valorNum },
      {
        onSuccess: () => {
          form.reset();
          setShowForm(false);
        },
      }
    );
  };

  const handleRemover = () => {
    if (!deleteId) return;
    const limite = limites.find((l) => l.id === deleteId);
    if (!limite) return;
    removerLimite.mutate(limite.categoriaNome, { onSuccess: () => setDeleteId(null) });
  };

  // Summary stats
  const okCount = limites.filter((l) => l.status === "ok").length;
  const alertCount = limites.filter(
    (l) => l.status === "atencao" || l.status === "critico" || l.status === "excedido"
  ).length;
  const avgUse =
    limites.length > 0
      ? Math.round(limites.reduce((s, l) => s + l.percentualConsumido, 0) / limites.length)
      : 0;

  const totalGasto = limites.reduce((s, l) => s + l.gastoAtual, 0);
  const totalOrcamento = limites.reduce((s, l) => s + l.valorLimite, 0);
  const dayOfMonth = new Date().getDate() || 1;
  const pressureLabel =
    avgUse >= 85 ? "Crítica" : avgUse >= 70 ? "Alta" : avgUse >= 50 ? "Moderada" : "Baixa";
  const pressureDesc =
    avgUse >= 85
      ? "Orçamento em situação crítica"
      : avgUse >= 70
        ? "Atenção aos gastos recomendada"
        : avgUse >= 50
          ? "Controle de gastos dentro do esperado"
          : "Orçamento sob controle";
  const mostCritical =
    limites.length > 0
      ? [...limites].sort((a, b) => b.percentualConsumido - a.percentualConsumido)[0]
      : null;

  return (
    <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10">
      {/* ── Hero Banner ───────────────────────────────────────────── */}
      <div className="exec-card flex flex-col items-center gap-6 rounded-2xl p-5 sm:gap-8 sm:rounded-[2.5rem] sm:p-8 md:flex-row lg:gap-12 lg:rounded-[3rem] lg:p-10 xl:gap-16 xl:p-12">
        <div className="flex-1">
          <h2 className="mb-3 text-2xl serif-italic text-slate-900 dark:text-white sm:mb-4 sm:text-3xl lg:text-4xl xl:text-5xl">
            Controle de Gastos
          </h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-8 max-w-lg">
            Visão consolidada do seu orçamento mensal por categoria. Acompanhe a execução dos
            limites em tempo real para evitar surpresas no fechamento.
          </p>
          <div className="flex gap-6 sm:gap-8 lg:gap-12 xl:gap-16 flex-wrap">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">
                Gasto Total Acumulado
              </p>
              <p className="text-xl mono-data font-medium text-slate-900 dark:text-white sm:text-2xl lg:text-3xl">
                {formatCurrency(totalGasto)}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">
                Orçamento Total
              </p>
              <p className="text-xl sm:text-2xl lg:text-3xl mono-data font-medium text-emerald-600">
                {formatCurrency(totalOrcamento)}
              </p>
            </div>
          </div>
        </div>
        <div className="w-full shrink-0 md:w-[360px] lg:w-[420px]">
          <div className="flex justify-between items-end mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Progresso do Orçamento
            </span>
            <span className="text-2xl mono-data font-bold text-slate-900 dark:text-white">
              {avgUse}%
            </span>
          </div>
          <div className="relative h-12 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800/80">
            <div
              className={`h-full flex items-center px-4 transition-all ${avgUse > 80 ? "bg-rose-500" : avgUse > 60 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${Math.min(avgUse, 100)}%` }}
            >
              {avgUse > 15 && (
                <span className="text-white text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                  Realizado
                </span>
              )}
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                Orçado
              </span>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-slate-400 italic">
            Você utilizou {formatCurrency(totalGasto)} dos {formatCurrency(totalOrcamento)}{" "}
            planejados para este ciclo.
          </p>
        </div>
      </div>

      {/* ── Section Header ───────────────────────────────────────── */}
      <div className="flex flex-col gap-4 px-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 sm:gap-6">
          <h3 className="text-2xl serif-italic text-slate-900 dark:text-white">
            Limites por Categoria
          </h3>
          <div className="hidden h-px w-24 bg-slate-200 dark:bg-slate-700 sm:block" />
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={categoriasDisponiveis.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-emerald-600 transition-transform hover:translate-x-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:justify-start sm:rounded-none sm:border-none sm:bg-transparent sm:px-0 sm:py-0"
        >
          <Plus className="h-4 w-4" />
          Ajustar Limites
        </button>
      </div>

      {/* ── Limits Table ─────────────────────────────────────────── */}
      {loading ? (
        <CardSkeleton count={3} />
      ) : isError ? (
        <ErrorState message={error?.message} onRetry={() => refetch()} />
      ) : limites.length === 0 ? (
        <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-6 sm:p-8 lg:p-12">
          <EmptyState
            icon={<Gauge className="h-6 w-6" />}
            title="Nenhum limite definido"
            description="Defina limites de gasto por categoria para acompanhar seus gastos de forma visual"
            action={
              <button
                onClick={() => setShowForm(true)}
                className="bg-emerald-600 text-white px-5 py-2.5 rounded-2xl font-medium shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer text-sm"
              >
                <Plus className="h-4 w-4" />
                Definir primeiro limite
              </button>
            }
          />
        </div>
      ) : (
        <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] overflow-hidden">
          {/* Desktop Header row — hidden on mobile */}
          <div className="hidden lg:grid grid-cols-12 gap-4 border-b border-slate-100/80 bg-slate-50 px-6 py-6 dark:border-slate-700/50 dark:bg-slate-800/40 xl:px-10">
            <div className="col-span-4 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Categoria
            </div>
            <div className="col-span-2 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Status
            </div>
            <div className="col-span-3 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Consumo &amp; Média Diária
            </div>
            <div className="col-span-2 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 text-right">
              Limite Definido
            </div>
            <div className="col-span-1 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 text-right">
              Ação
            </div>
          </div>

          {/* Mobile card view */}
          <div className="divide-y divide-slate-50 dark:divide-slate-800/50 lg:hidden">
            {limites.map((l) => {
              const diff = l.valorLimite - l.gastoAtual;
              const diffText =
                diff >= 0
                  ? `Faltam ${formatCurrency(diff)}`
                  : `Excedido em ${formatCurrency(Math.abs(diff))}`;
              const diffColor =
                diff < 0
                  ? "text-rose-600"
                  : l.status === "atencao"
                    ? "text-amber-600"
                    : "text-emerald-600";
              const pct = Math.min(l.percentualConsumido, 100);
              const pctColor =
                l.status === "ok"
                  ? "text-emerald-600"
                  : l.status === "atencao"
                    ? "text-amber-500"
                    : "text-rose-600";
              return (
                <div key={l.id} className="p-4 sm:p-6 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${statusBgColor(l.status)}`}
                      >
                        {statusIcon(l.status)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                          {l.categoriaNome}
                        </h4>
                        <p className={`text-[10px] font-medium ${diffColor}`}>{diffText}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border ${statusBadgeCls(l.status)}`}
                      >
                        {statusLabel(l.status, true)}
                      </span>
                      <button
                        onClick={() => setDeleteId(l.id)}
                        aria-label={`Remover limite de ${l.categoriaNome}`}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500">
                        Limite: {formatCurrency(l.valorLimite)}
                      </span>
                      <span className={`font-bold ${pctColor}`}>
                        {l.percentualConsumido.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${progressColor(l.status)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Data rows — hidden on mobile */}
          <div className="hidden lg:block">
            {limites.map((l, i) => {
              const diff = l.valorLimite - l.gastoAtual;
              const diffText =
                diff >= 0
                  ? `Faltam ${formatCurrency(diff)} para o limite`
                  : `Excedido em ${formatCurrency(Math.abs(diff))}`;
              const diffColor =
                diff < 0
                  ? "text-rose-600"
                  : l.status === "atencao"
                    ? "text-amber-600"
                    : "text-emerald-600";
              const mediaDiaria = l.gastoAtual / dayOfMonth;
              const pct = Math.min(l.percentualConsumido, 100);
              const pctColor =
                l.status === "ok"
                  ? "text-emerald-600"
                  : l.status === "atencao"
                    ? "text-amber-500"
                    : "text-rose-600";
              const isLast = i === limites.length - 1;
              return (
                <div
                  key={l.id}
                  className={`grid grid-cols-12 gap-4 px-6 xl:px-10 py-8 items-center group hover:bg-slate-50/50 transition-all${!isLast ? " border-b border-slate-50" : ""}`}
                >
                  {/* Categoria */}
                  <div className="col-span-4 flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${statusBgColor(l.status)}`}
                    >
                      {statusIcon(l.status)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        {l.categoriaNome}
                      </h4>
                      <p className={`text-[10px] font-medium ${diffColor}`}>{diffText}</p>
                    </div>
                  </div>
                  {/* Status */}
                  <div className="col-span-2">
                    <span
                      className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${statusBadgeCls(l.status)}`}
                    >
                      {statusLabel(l.status)}
                    </span>
                  </div>
                  {/* Consumo & Média Diária */}
                  <div className="col-span-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] mono-data font-bold text-slate-500 whitespace-nowrap">
                        Média: {formatCurrency(mediaDiaria)}/dia
                      </span>
                      <span className={`text-[10px] font-bold ${pctColor}`}>
                        {l.percentualConsumido.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${progressColor(l.status)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  {/* Limite Definido */}
                  <div className="col-span-2 text-right">
                    <p className="text-sm mono-data font-medium text-slate-900 dark:text-white">
                      {formatCurrency(l.valorLimite)}
                    </p>
                  </div>
                  {/* Ação */}
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={() => setDeleteId(l.id)}
                      aria-label={`Remover limite de ${l.categoriaNome}`}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 opacity-0 group-hover:opacity-100 cursor-pointer dark:hover:bg-rose-500/10"
                      title="Remover limite"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Bottom Insights ───────────────────────────────────────── */}
      {!loading && !isError && limites.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 pb-4">
          {/* Análise */}
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 dark:border-emerald-500/15 dark:bg-emerald-500/10 sm:rounded-[2.5rem] sm:p-8 lg:col-span-2 lg:rounded-[3rem] lg:p-10">
            <div className="flex items-start gap-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-500/10">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h5 className="mb-2 text-xl serif-italic text-emerald-900 dark:text-emerald-100">
                  Análise de Gastos por Categoria
                </h5>
                <p className="text-sm leading-relaxed text-emerald-800/80 dark:text-emerald-100/80">
                  {mostCritical && mostCritical.percentualConsumido >= 80
                    ? `A categoria "${mostCritical.categoriaNome}" está com ${mostCritical.percentualConsumido.toFixed(0)}% do limite consumido — requer atenção imediata. `
                    : ""}
                  {okCount === limites.length
                    ? "Todas as categorias estão dentro do limite. Excelente controle financeiro!"
                    : alertCount > 0
                      ? `${alertCount} ${alertCount === 1 ? "categoria precisa" : "categorias precisam"} de atenção. Monitore os gastos para evitar estouro do orçamento.`
                      : "Acompanhe seus limites regularmente para manter o orçamento equilibrado."}
                </p>
              </div>
            </div>
          </div>
          {/* Status de Pressão Orçamentária */}
          <div className="bg-[#0F172A] rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-5 sm:p-8 lg:p-10 text-white flex flex-col justify-between min-h-[140px] sm:min-h-[180px]">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-60">
              Status de Pressão Orçamentária
            </p>
            <div>
              <span className="text-3xl serif-italic">{pressureLabel}</span>
              <p className="text-[10px] opacity-60 mt-2 uppercase tracking-widest">
                {pressureDesc}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ New Limit Dialog ═══ */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <DialogHeader>
            <div className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-emerald-600/[0.08] bg-emerald-600/[0.03] p-3.5 sm:p-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-emerald-600/15 text-emerald-600 shadow-sm shadow-emerald-500/10 transition-all duration-500">
                <Gauge className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-semibold">
                  Definir Limite
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs sm:text-[13px] mt-0.5">
                  Configure um limite de gasto para uma categoria
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Form body */}
          <div>
            <form onSubmit={form.handleSubmit(handleSalvar)} className="space-y-4 sm:space-y-5">
              {/* Main fields */}
              <div className="space-y-4 rounded-2xl border border-emerald-600/[0.08] dark:border-slate-700/40 bg-white dark:bg-slate-800/60 shadow-[0_1px_6px_rgba(16,185,129,0.06)] dark:shadow-none p-4 sm:p-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Categoria
                  </Label>
                  <Select
                    value={categoriaWatch}
                    onValueChange={(v) => form.setValue("categoria", v, { shouldValidate: true })}
                  >
                    <SelectTrigger
                      className={`h-11 rounded-xl border-border/40 bg-background focus:ring-1 focus:ring-primary/30 ${form.formState.errors.categoria ? "border-red-500" : ""}`}
                    >
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriasDisponiveis.map((c) => (
                        <SelectItem key={c.id} value={c.nome}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.categoria && (
                    <p className="text-xs text-red-500 font-medium">
                      {form.formState.errors.categoria.message}
                    </p>
                  )}
                  {categoriasDisponiveis.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      Todas as categorias já possuem limites definidos.
                    </p>
                  )}
                </div>

                <div className="border-t border-border/20" />

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Valor Limite (R$)
                  </Label>
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-11 sm:w-12 flex items-center justify-center rounded-l-xl text-sm font-bold bg-emerald-600/10 text-emerald-600">
                      R$
                    </div>
                    <CurrencyInput
                      placeholder="0,00"
                      className={`h-12 sm:h-14 rounded-xl pl-12 sm:pl-14 text-xl sm:text-2xl tabular-nums font-bold border-border/40 bg-background placeholder:text-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all ${form.formState.errors.valor ? "border-red-500" : ""}`}
                      value={form.watch("valor")}
                      onValueChange={(v) =>
                        form.setValue("valor", v, { shouldValidate: form.formState.isSubmitted })
                      }
                    />
                  </div>
                  {form.formState.errors.valor && (
                    <p className="text-xs text-red-500 font-medium">
                      {form.formState.errors.valor.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Preview */}
              {categoriaWatch && valorWatch && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-emerald-600/[0.08] dark:border-slate-700/40 bg-white dark:bg-slate-800/60 shadow-[0_1px_6px_rgba(16,185,129,0.06)] dark:shadow-none p-4 sm:p-5 space-y-3"
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Preview
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm text-slate-800 dark:text-white">
                        {categoriaWatch}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Limite: {formatCurrency(parseFloat(valorWatch.replace(",", ".")) || 0)}
                      </p>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
                      0%
                    </Badge>
                  </div>
                </motion.div>
              )}

              {/* Submit */}
              <div className="pt-2 sm:pt-3 pb-safe">
                <Button
                  type="submit"
                  className="w-full h-12 sm:h-13 rounded-xl sm:rounded-2xl gap-2 sm:gap-2.5 font-semibold text-sm sm:text-[15px] bg-emerald-600 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 text-white transition-all duration-300 cursor-pointer active:scale-[0.98]"
                  disabled={!categoriaWatch}
                  loading={definirLimite.isPending}
                >
                  <Gauge className="h-5 w-5" />
                  Salvar Limite
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Delete Dialog ═══ */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader className="items-start text-left">
            <AlertDialogTitle className="sr-only">Remover limite?</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              Tem certeza que deseja remover este limite? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
            <DialogShellHeader
              icon={<Trash2 className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Remover limite?"
              description="Tem certeza que deseja remover este limite? Essa ação não pode ser desfeita."
              tone="rose"
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemover}
              loading={removerLimite.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
