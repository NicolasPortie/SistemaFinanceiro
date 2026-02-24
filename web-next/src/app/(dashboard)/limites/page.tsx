"use client";

import { useState } from "react";
import { useLimites, useCategorias, useDefinirLimite, useRemoverLimite } from "@/hooks/use-queries";
import { formatCurrency } from "@/lib/format";
import { limiteSchema, type LimiteData } from "@/lib/schemas";
import { motion, AnimatePresence } from "framer-motion";
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
  Shield,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import {
  EmptyState,
  ErrorState,
  CardSkeleton,
} from "@/components/shared/page-components";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

/* ────────────────────────────────────────────── */
/* Helpers                                         */
/* ────────────────────────────────────────────── */

function statusIcon(status: string) {
  switch (status) {
    case "ok": return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    case "atencao": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case "critico": return <AlertCircle className="h-5 w-5 text-red-500" />;
    case "excedido": return <XCircle className="h-5 w-5 text-red-600" />;
    default: return <Gauge className="h-5 w-5 text-slate-400" />;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "ok": return "Dentro do limite";
    case "atencao": return "Atenção";
    case "critico": return "Crítico";
    case "excedido": return "Excedido";
    default: return status;
  }
}

function statusBgColor(status: string) {
  switch (status) {
    case "ok": return "bg-emerald-50 dark:bg-emerald-500/10";
    case "atencao": return "bg-amber-50 dark:bg-amber-500/10";
    case "critico": return "bg-red-50 dark:bg-red-500/10";
    case "excedido": return "bg-red-50 dark:bg-red-500/10";
    default: return "bg-slate-50 dark:bg-slate-800/30";
  }
}

function progressColor(status: string) {
  switch (status) {
    case "ok": return "bg-emerald-500";
    case "atencao": return "bg-amber-500";
    case "critico": return "bg-red-500";
    case "excedido": return "bg-red-600";
    default: return "bg-emerald-600";
  }
}

function statusBadgeCls(status: string) {
  switch (status) {
    case "ok": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
    case "atencao": return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800";
    case "critico": return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800";
    case "excedido": return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800";
    default: return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
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
      { onSuccess: () => { form.reset(); setShowForm(false); } }
    );
  };

  const handleRemover = () => {
    if (!deleteId) return;
    const limite = limites.find((l) => l.id === deleteId);
    if (!limite) return;
    removerLimite.mutate(limite.categoriaNome, { onSuccess: () => setDeleteId(null) });
  };

  // Summary stats
  const okCount = limites.filter(l => l.status === "ok").length;
  const alertCount = limites.filter(l => l.status === "atencao" || l.status === "critico" || l.status === "excedido").length;
  const avgUse = limites.length > 0 ? Math.round(limites.reduce((s, l) => s + l.percentualConsumido, 0) / limites.length) : 0;

  return (
    <div className="space-y-6">
      {/* ═══ Page Header ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/50 dark:border-slate-700/30 rounded-2xl p-4 lg:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="size-10 flex items-center justify-center bg-emerald-600/10 rounded-xl">
            <Gauge className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
              Limites por Categoria
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Defina limites de gasto para manter o controle financeiro
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => refetch()} className="p-2.5 hover:bg-white/60 dark:hover:bg-slate-700/60 rounded-xl transition-colors cursor-pointer">
                  <RefreshCw className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Atualizar dados</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <button
            onClick={() => setShowForm(true)}
            disabled={categoriasDisponiveis.length === 0}
            className="bg-emerald-600 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-2 cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Definir Limite</span>
            <span className="sm:hidden">Novo</span>
          </button>
        </div>
      </motion.div>

      {/* ═══ Content ═══ */}
      {loading ? (
        <CardSkeleton count={4} />
      ) : isError ? (
        <ErrorState message={error?.message} onRetry={() => refetch()} />
      ) : limites.length > 0 ? (
        <>
          {/* ═══ Stat Cards ═══ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {/* Total limites */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }} className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300">
              <div className="absolute -right-6 -bottom-6 bg-emerald-500/10 w-28 h-28 rounded-full blur-2xl group-hover:bg-emerald-500/15 transition-all" />
              <div className="flex items-center justify-between relative z-10">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cadastrados</span>
                <div className="size-9 flex items-center justify-center bg-emerald-600/10 rounded-xl">
                  <Gauge className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
              <div className="relative z-10">
                <p className="text-2xl font-bold text-slate-800 dark:text-white">{limites.length}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">limites ativos</p>
              </div>
            </motion.div>

            {/* Dentro do limite */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300">
              <div className="absolute -right-6 -bottom-6 bg-emerald-500/10 w-28 h-28 rounded-full blur-2xl group-hover:bg-emerald-500/15 transition-all" />
              <div className="flex items-center justify-between relative z-10">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dentro do Limite</span>
                <div className="size-9 flex items-center justify-center bg-emerald-500/10 rounded-xl">
                  <Shield className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
              <div className="relative z-10">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{okCount}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">categorias ok</p>
              </div>
            </motion.div>

            {/* Em alerta */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300">
              <div className="absolute -right-6 -bottom-6 bg-amber-500/10 w-28 h-28 rounded-full blur-2xl group-hover:bg-amber-500/15 transition-all" />
              <div className="flex items-center justify-between relative z-10">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Em Alerta</span>
                <div className="size-9 flex items-center justify-center bg-amber-500/10 rounded-xl">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
              </div>
              <div className="relative z-10">
                <p className={`text-2xl font-bold ${alertCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-800 dark:text-white"}`}>{alertCount}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">precisam atenção</p>
              </div>
            </motion.div>

            {/* Uso médio */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300 ring-2 ring-emerald-600/20">
              <div className="absolute -right-6 -bottom-6 bg-emerald-600/10 w-28 h-28 rounded-full blur-2xl group-hover:bg-emerald-600/15 transition-all" />
              <div className="flex items-center justify-between relative z-10">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Uso Médio</span>
                <div className="size-9 flex items-center justify-center bg-emerald-600/10 rounded-xl">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
              <div className="relative z-10">
                <p className="text-2xl font-bold text-slate-800 dark:text-white">{avgUse}%</p>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-1000 ${avgUse > 80 ? "bg-red-500" : avgUse > 60 ? "bg-amber-500" : "bg-emerald-600"}`}
                    style={{ width: `${Math.min(avgUse, 100)}%` }}
                  />
                </div>
              </div>
            </motion.div>
          </div>

          {/* ═══ Limits Grid ═══ */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {limites.map((l, i) => (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-panel p-5 rounded-2xl group transition-all hover:shadow-lg hover:-translate-y-0.5 duration-300 relative overflow-hidden"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${statusBgColor(l.status)} transition-transform duration-300 group-hover:scale-110`}>
                        {statusIcon(l.status)}
                      </div>
                      <div>
                        <h4 className="font-bold tracking-tight text-sm text-slate-800 dark:text-white">{l.categoriaNome}</h4>
                        <Badge variant="secondary" className={`text-[10px] font-semibold mt-0.5 border ${statusBadgeCls(l.status)}`}>
                          {statusLabel(l.status)}
                        </Badge>
                      </div>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all cursor-pointer"
                            onClick={() => setDeleteId(l.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Remover limite</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  {/* Circular progress + stats */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative h-16 w-16 shrink-0">
                      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-200 dark:text-slate-700" />
                        <circle
                          cx="32" cy="32" r="26" fill="none"
                          strokeWidth="5" strokeLinecap="round"
                          className={progressColor(l.status)}
                          stroke="currentColor"
                          strokeDasharray={`${Math.min(l.percentualConsumido, 100) * 1.634} 163.4`}
                          style={{ transition: "stroke-dasharray 1s ease-out" }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-extrabold tabular-nums text-slate-800 dark:text-white">{l.percentualConsumido.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400 font-medium text-xs">Gasto</span>
                        <span className="font-bold tabular-nums text-slate-800 dark:text-white text-sm">{formatCurrency(l.gastoAtual)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400 font-medium text-xs">Limite</span>
                        <span className="font-bold tabular-nums text-slate-800 dark:text-white text-sm">{formatCurrency(l.valorLimite)}</span>
                      </div>
                      <div className="border-t border-slate-200 dark:border-slate-700/50 my-1" />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400 font-medium text-xs">Disponível</span>
                        <span className={`font-bold tabular-nums text-sm ${l.valorLimite - l.gastoAtual >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {formatCurrency(Math.max(l.valorLimite - l.gastoAtual, 0))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom progress bar */}
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700/50 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${progressColor(l.status)}`}
                      style={{ width: `${Math.min(l.percentualConsumido, 100)}%` }}
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-2xl p-12">
          <EmptyState
            icon={<Gauge className="h-6 w-6" />}
            title="Nenhum limite definido"
            description="Defina limites de gasto por categoria para acompanhar seus gastos de forma visual"
            action={
              <button
                onClick={() => setShowForm(true)}
                className="bg-emerald-600 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-2 cursor-pointer text-sm"
              >
                <Plus className="h-4 w-4" />
                Definir primeiro limite
              </button>
            }
          />
        </motion.div>
      )}

      {/* ═══ New Limit Sheet ═══ */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="w-full sm:w-125 sm:max-w-125 overflow-hidden">
          {/* Accent line */}
          <div className="h-1.5 w-full shrink-0 bg-linear-to-r from-emerald-600 via-emerald-400 to-teal-500 shadow-[0_2px_8px_rgba(16,185,129,0.3)]" />

          {/* Header */}
          <SheetHeader className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 sm:pb-5">
            <div className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-emerald-600/[0.08] bg-emerald-600/[0.03] p-3.5 sm:p-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-emerald-600/15 text-emerald-600 shadow-sm shadow-emerald-500/10 transition-all duration-500">
                <Gauge className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-lg sm:text-xl font-semibold">Definir Limite</SheetTitle>
                <SheetDescription className="text-muted-foreground text-xs sm:text-[13px] mt-0.5 truncate">Configure um limite de gasto para uma categoria</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <form onSubmit={form.handleSubmit(handleSalvar)} className="px-5 sm:px-7 pb-8 space-y-4 sm:space-y-5">
              {/* Main fields */}
              <div className="space-y-4 rounded-2xl border border-emerald-600/[0.08] dark:border-slate-700/40 bg-white dark:bg-slate-800/60 shadow-[0_1px_6px_rgba(16,185,129,0.06)] dark:shadow-none p-4 sm:p-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Categoria</Label>
                  <Select value={categoriaWatch} onValueChange={(v) => form.setValue("categoria", v, { shouldValidate: true })}>
                    <SelectTrigger className={`h-11 rounded-xl border-border/40 bg-background focus:ring-1 focus:ring-primary/30 ${form.formState.errors.categoria ? "border-red-500" : ""}`}>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriasDisponiveis.map((c) => (
                        <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.categoria && <p className="text-xs text-red-500 font-medium">{form.formState.errors.categoria.message}</p>}
                  {categoriasDisponiveis.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Todas as categorias já possuem limites definidos.</p>
                  )}
                </div>

                <div className="border-t border-border/20" />

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor Limite (R$)</Label>
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-11 sm:w-12 flex items-center justify-center rounded-l-xl text-sm font-bold bg-emerald-600/10 text-emerald-600">R$</div>
                    <CurrencyInput
                      placeholder="0,00"
                      className={`h-12 sm:h-14 rounded-xl pl-12 sm:pl-14 text-xl sm:text-2xl tabular-nums font-bold border-border/40 bg-background placeholder:text-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all ${form.formState.errors.valor ? "border-red-500" : ""}`}
                      value={form.watch("valor")}
                      onValueChange={(v) => form.setValue("valor", v, { shouldValidate: form.formState.isSubmitted })}
                    />
                  </div>
                  {form.formState.errors.valor && <p className="text-xs text-red-500 font-medium">{form.formState.errors.valor.message}</p>}
                </div>
              </div>

              {/* Preview */}
              {categoriaWatch && valorWatch && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-emerald-600/[0.08] dark:border-slate-700/40 bg-white dark:bg-slate-800/60 shadow-[0_1px_6px_rgba(16,185,129,0.06)] dark:shadow-none p-4 sm:p-5 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Preview</p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm text-slate-800 dark:text-white">{categoriaWatch}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Limite: {formatCurrency(parseFloat(valorWatch.replace(",", ".")) || 0)}</p>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">0%</Badge>
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
        </SheetContent>
      </Sheet>

      {/* ═══ Delete Dialog ═══ */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover limite?</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja remover este limite? Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemover} loading={removerLimite.isPending} className="bg-red-600 text-white hover:bg-red-700 rounded-xl gap-2">
              <Trash2 className="h-4 w-4" />Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
