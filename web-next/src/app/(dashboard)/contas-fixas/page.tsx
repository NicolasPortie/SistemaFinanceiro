"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  useLembretes,
  useCriarLembrete,
  useAtualizarLembrete,
  useDesativarLembrete,
  useCategorias,
} from "@/hooks/use-queries";
import { formatCurrency, formatShortDate } from "@/lib/format";
import type { FrequenciaLembrete } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { lembreteSchema, type LembreteData } from "@/lib/schemas";
import {
  CalendarClock,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  Loader2,
  Repeat,
  DollarSign,
  AlertCircle,
  Search,
  X,
  SlidersHorizontal,
  RefreshCw,
  Calendar,
  FileText,
  AlertTriangle,
  Clock,
} from "lucide-react";
import {
  PageShell,
  PageHeader,
  StatCard,
  EmptyState,
  ErrorState,
  CardSkeleton,
} from "@/components/shared/page-components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import type { LembretePagamento } from "@/lib/api";

const isVencido = (dataVenc: string) => new Date(dataVenc) < new Date(new Date().toISOString().split("T")[0]);

const isProximo = (dataVenc: string) => {
  const diff = new Date(dataVenc).getTime() - new Date(new Date().toISOString().split("T")[0]).getTime();
  return diff >= 0 && diff <= 3 * 24 * 60 * 60 * 1000;
};

/** Calcula a próxima ocorrência de um dia do mês (ex: dia 10 → próximo dia 10) */
function getNextOccurrenceDate(day: number): string {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const thisMonth = new Date(y, m, day);
  if (thisMonth >= new Date(today.toISOString().split("T")[0])) {
    return thisMonth.toISOString().split("T")[0];
  }
  return new Date(y, m + 1, day).toISOString().split("T")[0];
}

function getStatusInfo(dataVenc: string) {
  if (isVencido(dataVenc)) return { label: "Vencido", color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-500/15", icon: AlertCircle, badgeClass: "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10" };
  if (isProximo(dataVenc)) return { label: "Próximo", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-500/15", icon: AlertTriangle, badgeClass: "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10" };
  return { label: "Em dia", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/15", icon: CheckCircle2, badgeClass: "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10" };
}

export default function ContasFixasPage() {
  const { data: lembretes = [], isLoading, isError, error, refetch } = useLembretes();
  const { data: categorias = [] } = useCategorias();
  const criarLembrete = useCriarLembrete();
  const atualizarLembrete = useAtualizarLembrete();
  const desativarLembrete = useDesativarLembrete();

  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<LembretePagamento | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  // Form instances (Zod + react-hook-form)
  const createForm = useForm<LembreteData>({
    resolver: zodResolver(lembreteSchema),
    defaultValues: { descricao: "", valor: "", dataVencimento: "", diaRecorrente: "", frequencia: "Unico", diaSemana: "", categoria: "", formaPagamento: "", lembreteTelegramAtivo: true, dataFimRecorrencia: "" },
  });

  const editForm = useForm<LembreteData>({
    resolver: zodResolver(lembreteSchema),
    defaultValues: { descricao: "", valor: "", dataVencimento: "", diaRecorrente: "", frequencia: "Unico", diaSemana: "", categoria: "", formaPagamento: "", lembreteTelegramAtivo: true, dataFimRecorrencia: "" },
  });

  const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  const resetForm = () => {
    createForm.reset();
    editForm.reset();
    setShowForm(false);
    setEditItem(null);
  };

  const openEdit = (lembrete: LembretePagamento) => {
    setEditItem(lembrete);
    // Match categoria by categoriaId for reliable pre-fill
    const matchedCat = categorias.find(c => c.id === lembrete.categoriaId);
    editForm.reset({
      descricao: lembrete.descricao,
      valor: lembrete.valor?.toString() ?? "",
      dataVencimento: lembrete.dataVencimento,
      diaRecorrente: lembrete.diaRecorrente?.toString() ?? "",
      frequencia: lembrete.frequencia ?? (lembrete.recorrenteMensal ? "Mensal" : "Unico"),
      diaSemana: lembrete.diaSemanaRecorrente?.toString() ?? "",
      categoria: matchedCat?.nome ?? lembrete.categoria ?? "",
      formaPagamento: (lembrete.formaPagamento ?? "").toLowerCase(),
      lembreteTelegramAtivo: lembrete.lembreteTelegramAtivo ?? true,
      dataFimRecorrencia: lembrete.dataFimRecorrencia ?? "",
    });
  };

  const handleCriar = (data: LembreteData) => {
    const isRecorrente = data.frequencia !== "Unico";
    let vencimento = data.dataVencimento || "";

    if (data.frequencia === "Mensal" && data.diaRecorrente) {
      vencimento = getNextOccurrenceDate(parseInt(data.diaRecorrente));
    }

    const valorNum = parseFloat(data.valor.replace(",", "."));

    criarLembrete.mutate(
      {
        descricao: data.descricao.trim(),
        valor: valorNum,
        dataVencimento: vencimento,
        recorrenteMensal: isRecorrente,
        diaRecorrente: data.frequencia === "Mensal" && data.diaRecorrente ? parseInt(data.diaRecorrente) : undefined,
        frequencia: isRecorrente ? data.frequencia as FrequenciaLembrete : undefined,
        diaSemanaRecorrente: (data.frequencia === "Semanal" || data.frequencia === "Quinzenal") && data.diaSemana ? parseInt(data.diaSemana) : undefined,
        categoria: data.categoria.trim(),
        formaPagamento: data.formaPagamento,
        lembreteTelegramAtivo: data.lembreteTelegramAtivo,
        dataFimRecorrencia: isRecorrente && data.dataFimRecorrencia ? data.dataFimRecorrencia : undefined,
      },
      { onSuccess: resetForm }
    );
  };

  const handleAtualizar = (data: LembreteData) => {
    if (!editItem) return;
    const isRecorrente = data.frequencia !== "Unico";
    const valorNum = parseFloat(data.valor.replace(",", "."));

    let vencimento = data.dataVencimento || undefined;
    if (data.frequencia === "Mensal" && data.diaRecorrente) {
      vencimento = getNextOccurrenceDate(parseInt(data.diaRecorrente));
    }
    atualizarLembrete.mutate(
      {
        id: editItem.id,
        data: {
          descricao: data.descricao.trim() || undefined,
          valor: valorNum,
          dataVencimento: vencimento,
          recorrenteMensal: isRecorrente,
          diaRecorrente: data.frequencia === "Mensal" && data.diaRecorrente ? parseInt(data.diaRecorrente) : undefined,
          frequencia: isRecorrente ? data.frequencia as FrequenciaLembrete : undefined,
          diaSemanaRecorrente: (data.frequencia === "Semanal" || data.frequencia === "Quinzenal") && data.diaSemana ? parseInt(data.diaSemana) : undefined,
          categoria: data.categoria.trim(),
          formaPagamento: data.formaPagamento,
          lembreteTelegramAtivo: data.lembreteTelegramAtivo,
          dataFimRecorrencia: isRecorrente && data.dataFimRecorrencia ? data.dataFimRecorrencia : (isRecorrente ? undefined : ""),
        },
      },
      { onSuccess: resetForm }
    );
  };

  const handleDesativar = () => {
    if (!deleteId) return;
    desativarLembrete.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
  };

  // Filtered list
  const filtered = useMemo(() => {
    return lembretes.filter((l) => {
      if (busca.trim() && !l.descricao.toLowerCase().includes(busca.toLowerCase())) return false;
      if (filtroStatus === "vencido" && !isVencido(l.dataVencimento)) return false;
      if (filtroStatus === "proximo" && !isProximo(l.dataVencimento)) return false;
      if (filtroStatus === "emdia" && (isVencido(l.dataVencimento) || isProximo(l.dataVencimento))) return false;
      return true;
    });
  }, [lembretes, busca, filtroStatus]);

  const stats = useMemo(() => {
    const vencidos = lembretes.filter(l => isVencido(l.dataVencimento)).length;
    const proximos = lembretes.filter(l => isProximo(l.dataVencimento)).length;
    const total = lembretes.reduce((sum, l) => sum + (l.valor ?? 0), 0);
    return { vencidos, proximos, total, count: lembretes.length };
  }, [lembretes]);

  const activeFilters = (filtroStatus !== "todos" ? 1 : 0) + (busca.trim() ? 1 : 0);

  return (
    <PageShell>
      {/* ── Page Header ── */}
      <PageHeader title="Contas Fixas" description="Gerencie seus lembretes de pagamento e contas recorrentes">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Atualizar dados</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button onClick={() => { createForm.reset(); setShowForm(true); }} className="gap-2 h-10 px-5 rounded-xl shadow-premium font-semibold">
          <Plus className="h-4 w-4" />
          Novo Lembrete
        </Button>
      </PageHeader>

      {/* ── Stats Overview ── */}
      {isLoading ? (
        <CardSkeleton count={4} />
      ) : isError ? (
        <ErrorState message={error?.message} onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Contas"
            value={stats.count}
            icon={<FileText className="h-5 w-5" />}
            trend="neutral"
            delay={0}
          />
          <StatCard
            title="Valor Total"
            value={formatCurrency(stats.total)}
            icon={<DollarSign className="h-5 w-5" />}
            trend="neutral"
            delay={0.05}
          />
          <StatCard
            title="Vencidos"
            value={stats.vencidos}
            icon={<AlertCircle className="h-5 w-5" />}
            trend={stats.vencidos > 0 ? "down" : "up"}
            delay={0.1}
          />
          <StatCard
            title="Próximos"
            value={stats.proximos}
            icon={<Clock className="h-5 w-5" />}
            trend={stats.proximos > 0 ? "down" : "neutral"}
            delay={0.15}
          />
        </div>
      )}

      {/* ── Toolbar: Search + Filters ── */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card-premium">
        <div className="p-4 flex flex-col lg:flex-row items-start lg:items-center gap-3">
          <div className="relative flex-1 w-full lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input
              placeholder="Buscar lembretes..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-muted/30 border-transparent focus:border-primary/30 focus:bg-card transition-all"
            />
            {busca && (
              <button onClick={() => setBusca("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Separator orientation="vertical" className="h-6 hidden lg:block" />

          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground/60 hidden sm:block" />
            <div className="flex gap-1.5">
              {[
                { key: "todos", label: "Todos" },
                { key: "vencido", label: "Vencidos", color: "bg-red-500" },
                { key: "proximo", label: "Próximos", color: "bg-amber-500" },
                { key: "emdia", label: "Em dia", color: "bg-emerald-500" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFiltroStatus(f.key)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${filtroStatus === f.key
                    ? f.color
                      ? `${f.color} text-white shadow-sm`
                      : "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground hover:-translate-y-px"
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {activeFilters > 0 && (
              <button onClick={() => { setFiltroStatus("todos"); setBusca(""); }} className="ml-1 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200">
                <X className="h-3 w-3" />
                Limpar ({activeFilters})
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Bills Table ── */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card-premium overflow-hidden">
        {/* Table header */}
        <div className="hidden lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center px-6 py-3 border-b border-border/50 bg-muted/30">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Descrição</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Valor</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Vencimento</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Status</span>
          <span className="w-20" />
        </div>

        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando lembretes...</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="divide-y divide-border/30">
            <AnimatePresence>
              {filtered.map((l, i) => {
                const status = getStatusInfo(l.dataVencimento);
                const StatusIcon = status.icon;
                return (
                  <motion.div key={l.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ delay: 0.015 * i }} className="group">
                    {/* Desktop row */}
                    <div className="hidden lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center px-6 py-3.5 hover:bg-muted/20 transition-all duration-200">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${status.bg} ${status.color} transition-transform duration-300 group-hover:scale-110`}>
                          <StatusIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold truncate">{l.descricao}</p>
                          {(l.frequencia || l.recorrenteMensal) && (
                            <p className="text-[11px] text-muted-foreground/60 font-medium flex items-center gap-1">
                              <Repeat className="h-3 w-3" />
                              {l.frequencia === "Semanal" ? `Semanal · ${DIAS_SEMANA[l.diaSemanaRecorrente ?? 0]?.slice(0, 3)}`
                                : l.frequencia === "Quinzenal" ? `Quinzenal · ${DIAS_SEMANA[l.diaSemanaRecorrente ?? 0]?.slice(0, 3)}`
                                  : l.frequencia === "Anual" ? "Anual"
                                    : l.diaRecorrente ? `Dia ${l.diaRecorrente}` : "Mensal"}
                            </p>
                          )}
                        </div>
                      </div>

                      <span className="text-[13px] font-bold tabular-nums">{l.valor != null ? formatCurrency(l.valor) : "—"}</span>

                      <span className="text-[13px] text-muted-foreground/80 font-medium tabular-nums">{formatShortDate(l.dataVencimento)}</span>

                      <Badge variant="outline" className={`text-[11px] font-semibold w-fit ${status.badgeClass}`}>
                        {status.label}
                      </Badge>

                      <div className="flex items-center justify-end gap-0.5 w-20 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(l)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(l.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Desativar</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div className="lg:hidden flex items-center gap-3 px-4 py-3.5 hover:bg-muted/20 transition-colors">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${status.bg} ${status.color}`}>
                        <StatusIcon className="h-4.5 w-4.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate">{l.descricao}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-muted-foreground/60 font-medium">{formatShortDate(l.dataVencimento)}</span>
                          {(l.frequencia || l.recorrenteMensal) && (
                            <>
                              <span className="text-[11px] text-muted-foreground/40">·</span>
                              <span className="text-[11px] text-muted-foreground/60 font-medium flex items-center gap-0.5">
                                <Repeat className="h-2.5 w-2.5" />{l.frequencia ?? "Mensal"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        {l.valor != null && <span className="text-sm font-bold tabular-nums">{formatCurrency(l.valor)}</span>}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(l)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="p-12">
            <EmptyState
              icon={<CalendarClock className="h-6 w-6" />}
              title={activeFilters > 0 ? "Nenhum lembrete encontrado" : "Nenhum lembrete cadastrado"}
              description={activeFilters > 0 ? "Tente remover os filtros para ver mais resultados" : "Adicione contas fixas e lembretes de pagamento para manter o controle"}
              action={
                activeFilters > 0 ? (
                  <Button variant="outline" onClick={() => { setFiltroStatus("todos"); setBusca(""); }} className="gap-2">
                    <X className="h-4 w-4" />Limpar filtros
                  </Button>
                ) : (
                  <Button onClick={() => setShowForm(true)} className="gap-2 shadow-premium">
                    <Plus className="h-4 w-4" />Criar primeiro lembrete
                  </Button>
                )
              }
            />
          </div>
        )}
      </motion.div>

      {/* ── New Bill Sheet (Side Panel) ── */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="w-full sm:w-125 sm:max-w-125 overflow-hidden">
          {/* Accent line */}
          <div className="h-1 w-full shrink-0 bg-linear-to-r from-blue-400 via-indigo-500 to-violet-500" />

          {/* Header */}
          <SheetHeader className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 sm:pb-5">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-blue-500/10 text-blue-500 transition-all duration-500">
                <CalendarClock className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-lg sm:text-xl font-semibold">Nova Conta Fixa</SheetTitle>
                <SheetDescription className="text-muted-foreground text-xs sm:text-[13px] mt-0.5 truncate">Configure sua conta fixa ou pagamento recorrente</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <form onSubmit={createForm.handleSubmit(handleCriar)} className="px-5 sm:px-7 pb-8 space-y-4 sm:space-y-5">
              {/* Main fields */}
              <div className="space-y-4 rounded-2xl border border-border/40 bg-muted/15 p-4 sm:p-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Descrição</Label>
                  <Input placeholder="Ex: Aluguel, Internet, Energia..." {...createForm.register("descricao")} className={cn("h-11 rounded-xl border-border/40 bg-background placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all", createForm.formState.errors.descricao && "border-red-500")} />
                  {createForm.formState.errors.descricao && <p className="text-xs text-red-500 font-medium">{createForm.formState.errors.descricao.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor (R$)</Label>
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-11 sm:w-12 flex items-center justify-center rounded-l-xl text-sm font-bold bg-blue-500/10 text-blue-500">R$</div>
                    <Input placeholder="0,00" {...createForm.register("valor")} className={cn("h-12 sm:h-14 rounded-xl pl-12 sm:pl-14 text-xl sm:text-2xl tabular-nums font-bold border-border/40 bg-background placeholder:text-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all", createForm.formState.errors.valor && "border-red-500")} />
                  </div>
                  {createForm.formState.errors.valor && <p className="text-xs text-red-500 font-medium">{createForm.formState.errors.valor.message}</p>}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Categoria</Label>
                    <select
                      value={createForm.watch("categoria")}
                      onChange={(e) => createForm.setValue("categoria", e.target.value, { shouldValidate: true })}
                      className={cn("h-11 w-full rounded-xl border border-border/40 bg-background px-3 text-sm", createForm.formState.errors.categoria && "border-red-500")}
                    >
                      <option value="">Selecione</option>
                      {categorias.map((cat) => (
                        <option key={cat.id} value={cat.nome}>{cat.nome}</option>
                      ))}
                    </select>
                    {createForm.formState.errors.categoria && <p className="text-xs text-red-500 font-medium">{createForm.formState.errors.categoria.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Forma de pagamento</Label>
                    <select
                      value={createForm.watch("formaPagamento")}
                      onChange={(e) => createForm.setValue("formaPagamento", e.target.value, { shouldValidate: true })}
                      className={cn("h-11 w-full rounded-xl border border-border/40 bg-background px-3 text-sm", createForm.formState.errors.formaPagamento && "border-red-500")}
                    >
                      <option value="">Selecione</option>
                      <option value="pix">PIX</option>
                      <option value="debito">Débito</option>
                      <option value="credito">Crédito</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="outro">Outro</option>
                    </select>
                    {createForm.formState.errors.formaPagamento && <p className="text-xs text-red-500 font-medium">{createForm.formState.errors.formaPagamento.message}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Lembrete automático no Telegram</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => createForm.setValue("lembreteTelegramAtivo", true)}
                      className={cn(
                        "h-10 px-3 rounded-xl border text-sm font-medium",
                        createForm.watch("lembreteTelegramAtivo") ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400" : "border-border/40 text-muted-foreground"
                      )}
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => createForm.setValue("lembreteTelegramAtivo", false)}
                      className={cn(
                        "h-10 px-3 rounded-xl border text-sm font-medium",
                        !createForm.watch("lembreteTelegramAtivo") ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400" : "border-border/40 text-muted-foreground"
                      )}
                    >
                      Não
                    </button>
                  </div>
                </div>
              </div>

              {/* Frequency selector */}
              <div className="space-y-4 rounded-2xl border border-border/40 bg-muted/15 p-4 sm:p-5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Frequência</Label>
                <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                  {([
                    { key: "Unico" as const, label: "Único", icon: CalendarClock },
                    { key: "Semanal" as const, label: "Semanal", icon: Repeat },
                    { key: "Quinzenal" as const, label: "Quinzenal", icon: Repeat },
                    { key: "Mensal" as const, label: "Mensal", icon: Repeat },
                    { key: "Anual" as const, label: "Anual", icon: Calendar },
                  ] as const).map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => createForm.setValue("frequencia", key)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 sm:gap-2 p-2.5 sm:p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer",
                        createForm.watch("frequencia") === key
                          ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/10"
                          : "border-border/40 hover:border-border/60 text-muted-foreground hover:bg-muted/30"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[10px] sm:text-xs font-semibold leading-tight">{label}</span>
                    </button>
                  ))}
                </div>

                <div className="border-t border-border/20" />

                <AnimatePresence mode="wait">
                  {createForm.watch("frequencia") === "Unico" && (
                    <motion.div key="unico" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-1.5">
                      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Data do Pagamento</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                        <Input type="date" {...createForm.register("dataVencimento")} className={cn("h-11 rounded-xl pl-10 border-border/40 bg-background focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all", createForm.formState.errors.dataVencimento && "border-red-500")} />
                      </div>
                      {createForm.formState.errors.dataVencimento && <p className="text-xs text-red-500 font-medium">{createForm.formState.errors.dataVencimento.message}</p>}
                    </motion.div>
                  )}

                  {createForm.watch("frequencia") === "Mensal" && (
                    <motion.div key="mensal" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-2">
                      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Dia do vencimento no mês</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                        <Input type="number" min={1} max={31} placeholder="Ex: 10" {...createForm.register("diaRecorrente")} className={cn("h-11 rounded-xl pl-10 border-border/40 bg-background placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all", createForm.formState.errors.diaRecorrente && "border-red-500")} />
                      </div>
                      {createForm.formState.errors.diaRecorrente && <p className="text-xs text-red-500 font-medium">{createForm.formState.errors.diaRecorrente.message}</p>}
                      <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5">
                        <Repeat className="h-3 w-3" />
                        {createForm.watch("diaRecorrente") ? `Pagamento todo dia ${createForm.watch("diaRecorrente")} de cada mês` : "Informe o dia para repetir todo mês"}
                      </p>
                    </motion.div>
                  )}

                  {(createForm.watch("frequencia") === "Semanal" || createForm.watch("frequencia") === "Quinzenal") && (
                    <motion.div key="semanal" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Dia da semana</Label>
                        <div className="grid grid-cols-7 gap-1">
                          {DIAS_SEMANA.map((dia, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => createForm.setValue("diaSemana", String(idx))}
                              className={cn(
                                "p-1.5 sm:p-2 rounded-lg text-[10px] sm:text-xs font-medium transition-all cursor-pointer border",
                                createForm.watch("diaSemana") === String(idx)
                                  ? "border-blue-500 bg-blue-500/15 text-blue-600 dark:text-blue-400"
                                  : "border-transparent hover:bg-muted/40 text-muted-foreground"
                              )}
                            >
                              {dia.slice(0, 3)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Data do primeiro pagamento</Label>
                        <div className="relative">
                          <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                          <Input type="date" {...createForm.register("dataVencimento")} className={cn("h-11 rounded-xl pl-10 border-border/40 bg-background focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all", createForm.formState.errors.dataVencimento && "border-red-500")} />
                        </div>
                        {createForm.formState.errors.dataVencimento && <p className="text-xs text-red-500 font-medium">{createForm.formState.errors.dataVencimento.message}</p>}
                      </div>
                      <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5">
                        <Repeat className="h-3 w-3" />
                        {createForm.watch("frequencia") === "Semanal" ? "Repete toda semana" : "Repete a cada 15 dias"}
                        {createForm.watch("diaSemana") ? ` (${DIAS_SEMANA[parseInt(createForm.watch("diaSemana") || "0")]})` : ""}
                      </p>
                    </motion.div>
                  )}

                  {createForm.watch("frequencia") === "Anual" && (
                    <motion.div key="anual" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-2">
                      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Data do pagamento anual</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                        <Input type="date" {...createForm.register("dataVencimento")} className={cn("h-11 rounded-xl pl-10 border-border/40 bg-background focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all", createForm.formState.errors.dataVencimento && "border-red-500")} />
                      </div>
                      {createForm.formState.errors.dataVencimento && <p className="text-xs text-red-500 font-medium">{createForm.formState.errors.dataVencimento.message}</p>}
                      <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5">
                        <Repeat className="h-3 w-3" />
                        Repete uma vez por ano na mesma data
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Optional end date for recurring bills */}
              {createForm.watch("frequencia") !== "Unico" && (
                <div className="space-y-4 rounded-2xl border border-border/40 bg-muted/15 p-4 sm:p-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Até quando pagar? <span className="text-muted-foreground/40">(opcional)</span></Label>
                    <div className="relative">
                      <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                      <Input type="date" {...createForm.register("dataFimRecorrencia")} className="h-11 rounded-xl pl-10 border-border/40 bg-background focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all" />
                    </div>
                    <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5">
                      <CalendarClock className="h-3 w-3" />
                      {createForm.watch("dataFimRecorrencia") ? `Lembretes serão enviados até ${new Date(createForm.watch("dataFimRecorrencia") + "T12:00:00").toLocaleDateString("pt-BR")}` : "Se não informar, o lembrete continuará indefinidamente"}
                    </p>
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="pt-2 sm:pt-3 pb-safe">
                <Button
                  type="submit"
                  className="w-full h-12 sm:h-13 rounded-xl sm:rounded-2xl gap-2 sm:gap-2.5 font-semibold text-sm sm:text-[15px] bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 text-white transition-all duration-300 cursor-pointer active:scale-[0.98]"
                  disabled={criarLembrete.isPending}
                >
                  {criarLembrete.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      Criar Conta Fixa
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Edit Dialog ── */}
      <Dialog open={editItem !== null} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight">Editar Conta Fixa</DialogTitle>
            <DialogDescription>Altere os dados da conta fixa</DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleAtualizar)} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</Label>
              <Input {...editForm.register("descricao")} className={cn("h-11 rounded-xl", editForm.formState.errors.descricao && "border-red-500")} />
              {editForm.formState.errors.descricao && <p className="text-xs text-red-500 font-medium">{editForm.formState.errors.descricao.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor (R$)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input placeholder="0,00" {...editForm.register("valor")} className={cn("h-11 rounded-xl pl-9 tabular-nums", editForm.formState.errors.valor && "border-red-500")} />
              </div>
              {editForm.formState.errors.valor && <p className="text-xs text-red-500 font-medium">{editForm.formState.errors.valor.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categoria</Label>
                <select
                  value={editForm.watch("categoria")}
                  onChange={(e) => editForm.setValue("categoria", e.target.value, { shouldValidate: true })}
                  className={cn("h-11 w-full rounded-xl border border-border/40 bg-background px-3 text-sm", editForm.formState.errors.categoria && "border-red-500")}
                >
                  <option value="">Selecione</option>
                  {categorias.map((cat) => (
                    <option key={cat.id} value={cat.nome}>{cat.nome}</option>
                  ))}
                </select>
                {editForm.formState.errors.categoria && <p className="text-xs text-red-500 font-medium">{editForm.formState.errors.categoria.message}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Forma de pagamento</Label>
                <select
                  value={editForm.watch("formaPagamento")}
                  onChange={(e) => editForm.setValue("formaPagamento", e.target.value, { shouldValidate: true })}
                  className={cn("h-11 w-full rounded-xl border border-border/40 bg-background px-3 text-sm", editForm.formState.errors.formaPagamento && "border-red-500")}
                >
                  <option value="">Selecione</option>
                  <option value="pix">PIX</option>
                  <option value="debito">Débito</option>
                  <option value="credito">Crédito</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="outro">Outro</option>
                </select>
                {editForm.formState.errors.formaPagamento && <p className="text-xs text-red-500 font-medium">{editForm.formState.errors.formaPagamento.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lembrete automático no Telegram</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => editForm.setValue("lembreteTelegramAtivo", true)}
                  className={cn(
                    "h-10 px-3 rounded-xl border text-sm font-medium",
                    editForm.watch("lembreteTelegramAtivo") ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400" : "border-border/40 text-muted-foreground"
                  )}
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => editForm.setValue("lembreteTelegramAtivo", false)}
                  className={cn(
                    "h-10 px-3 rounded-xl border text-sm font-medium",
                    !editForm.watch("lembreteTelegramAtivo") ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400" : "border-border/40 text-muted-foreground"
                  )}
                >
                  Não
                </button>
              </div>
            </div>

            {/* Frequency selector */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Frequência</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {([
                  { key: "Unico" as const, label: "Único" },
                  { key: "Semanal" as const, label: "Semanal" },
                  { key: "Quinzenal" as const, label: "Quinz." },
                  { key: "Mensal" as const, label: "Mensal" },
                  { key: "Anual" as const, label: "Anual" },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => editForm.setValue("frequencia", key)}
                    className={cn(
                      "p-2 rounded-lg border-2 text-[11px] font-semibold transition-all duration-200 cursor-pointer",
                      editForm.watch("frequencia") === key
                        ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "border-border/40 hover:border-border/60 text-muted-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {editForm.watch("frequencia") === "Unico" && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data do Pagamento</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input type="date" {...editForm.register("dataVencimento")} className={cn("h-11 rounded-xl pl-9", editForm.formState.errors.dataVencimento && "border-red-500")} />
                </div>
                {editForm.formState.errors.dataVencimento && <p className="text-xs text-red-500 font-medium">{editForm.formState.errors.dataVencimento.message}</p>}
              </div>
            )}

            {editForm.watch("frequencia") === "Mensal" && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dia do vencimento no mês</Label>
                <Input type="number" min={1} max={31} placeholder="Ex: 10" {...editForm.register("diaRecorrente")} className={cn("h-11 rounded-xl", editForm.formState.errors.diaRecorrente && "border-red-500")} />
                {editForm.formState.errors.diaRecorrente && <p className="text-xs text-red-500 font-medium">{editForm.formState.errors.diaRecorrente.message}</p>}
                <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                  <Repeat className="h-3 w-3" />
                  {editForm.watch("diaRecorrente") ? `Todo dia ${editForm.watch("diaRecorrente")} de cada mês` : "Informe o dia"}
                </p>
              </div>
            )}

            {(editForm.watch("frequencia") === "Semanal" || editForm.watch("frequencia") === "Quinzenal") && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dia da semana</Label>
                  <div className="grid grid-cols-7 gap-1">
                    {DIAS_SEMANA.map((dia, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => editForm.setValue("diaSemana", String(idx))}
                        className={cn(
                          "p-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer border",
                          editForm.watch("diaSemana") === String(idx)
                            ? "border-blue-500 bg-blue-500/15 text-blue-600 dark:text-blue-400"
                            : "border-transparent hover:bg-muted/40 text-muted-foreground"
                        )}
                      >
                        {dia.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data do primeiro pagamento</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input type="date" {...editForm.register("dataVencimento")} className={cn("h-11 rounded-xl pl-9", editForm.formState.errors.dataVencimento && "border-red-500")} />
                  </div>
                  {editForm.formState.errors.dataVencimento && <p className="text-xs text-red-500 font-medium">{editForm.formState.errors.dataVencimento.message}</p>}
                </div>
              </div>
            )}

            {editForm.watch("frequencia") === "Anual" && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data do pagamento anual</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input type="date" {...editForm.register("dataVencimento")} className={cn("h-11 rounded-xl pl-9", editForm.formState.errors.dataVencimento && "border-red-500")} />
                </div>
                {editForm.formState.errors.dataVencimento && <p className="text-xs text-red-500 font-medium">{editForm.formState.errors.dataVencimento.message}</p>}
              </div>
            )}

            {/* Optional end date for recurring bills */}
            {editForm.watch("frequencia") !== "Unico" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Até quando pagar? <span className="text-muted-foreground/40">(opcional)</span></Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input type="date" {...editForm.register("dataFimRecorrencia")} className="h-11 rounded-xl pl-9" />
                </div>
                <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" />
                  {editForm.watch("dataFimRecorrencia") ? `Até ${new Date(editForm.watch("dataFimRecorrencia") + "T12:00:00").toLocaleDateString("pt-BR")}` : "Sem data limite"}
                </p>
              </div>
            )}

            <Button type="submit" className="w-full h-12 rounded-xl gap-2 font-bold shadow-premium btn-premium" disabled={atualizarLembrete.isPending}>
              {atualizarLembrete.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar alterações"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar lembrete?</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja desativar este lembrete? Ele não aparecerá mais na lista.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDesativar} disabled={desativarLembrete.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl gap-2">
              {desativarLembrete.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4" />Desativar</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
