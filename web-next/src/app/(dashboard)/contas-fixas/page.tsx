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
import { toast } from "sonner";
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

  // Form state
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [diaRecorrente, setDiaRecorrente] = useState("");
  const [frequencia, setFrequencia] = useState<FrequenciaLembrete | "Unico">("Unico");
  const [diaSemana, setDiaSemana] = useState("");
  const [categoria, setCategoria] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [lembreteTelegramAtivo, setLembreteTelegramAtivo] = useState(true);
  const [dataFimRecorrencia, setDataFimRecorrencia] = useState("");

  const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  const resetForm = () => {
    setDescricao("");
    setValor("");
    setDataVencimento("");
    setDiaRecorrente("");
    setFrequencia("Unico");
    setDiaSemana("");
    setCategoria("");
    setFormaPagamento("");
    setLembreteTelegramAtivo(true);
    setDataFimRecorrencia("");
    setShowForm(false);
    setEditItem(null);
  };

  const openEdit = (lembrete: LembretePagamento) => {
    setEditItem(lembrete);
    setDescricao(lembrete.descricao);
    setValor(lembrete.valor?.toString() ?? "");
    setDataVencimento(lembrete.dataVencimento);
    setDiaRecorrente(lembrete.diaRecorrente?.toString() ?? "");
    setFrequencia(lembrete.frequencia ?? (lembrete.recorrenteMensal ? "Mensal" : "Unico"));
    setDiaSemana(lembrete.diaSemanaRecorrente?.toString() ?? "");
    // Match categoria by categoriaId for reliable pre-fill
    const matchedCat = categorias.find(c => c.id === lembrete.categoriaId);
    setCategoria(matchedCat?.nome ?? lembrete.categoria ?? "");
    setFormaPagamento((lembrete.formaPagamento ?? "").toLowerCase());
    setLembreteTelegramAtivo(lembrete.lembreteTelegramAtivo ?? true);
    setDataFimRecorrencia(lembrete.dataFimRecorrencia ?? "");
  };

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim()) { toast.error("Informe a descrição"); return; }

    const isRecorrente = frequencia !== "Unico";
    let vencimento = dataVencimento;

    if (frequencia === "Mensal") {
      const dia = parseInt(diaRecorrente);
      if (!diaRecorrente || dia < 1 || dia > 31) { toast.error("Informe o dia de vencimento (1-31)"); return; }
      vencimento = getNextOccurrenceDate(dia);
    } else if (frequencia === "Semanal" || frequencia === "Quinzenal") {
      if (!dataVencimento) { toast.error("Informe a data do primeiro pagamento"); return; }
    } else if (frequencia === "Anual") {
      if (!dataVencimento) { toast.error("Informe a data do pagamento anual"); return; }
    } else {
      if (!dataVencimento) { toast.error("Informe a data do pagamento"); return; }
    }

    if (!valor.trim()) { toast.error("Informe o valor da conta fixa"); return; }
    if (!categoria.trim()) { toast.error("Selecione uma categoria"); return; }
    if (!formaPagamento.trim()) { toast.error("Selecione a forma de pagamento"); return; }

    const valorNum = valor ? parseFloat(valor.replace(",", ".")) : undefined;
    if (!valorNum || valorNum <= 0) { toast.error("Informe um valor válido"); return; }

    criarLembrete.mutate(
      {
        descricao: descricao.trim(),
        valor: valorNum,
        dataVencimento: vencimento,
        recorrenteMensal: isRecorrente,
        diaRecorrente: frequencia === "Mensal" && diaRecorrente ? parseInt(diaRecorrente) : undefined,
        frequencia: isRecorrente ? frequencia as FrequenciaLembrete : undefined,
        diaSemanaRecorrente: (frequencia === "Semanal" || frequencia === "Quinzenal") && diaSemana ? parseInt(diaSemana) : undefined,
        categoria: categoria.trim(),
        formaPagamento,
        lembreteTelegramAtivo,
        dataFimRecorrencia: isRecorrente && dataFimRecorrencia ? dataFimRecorrencia : undefined,
      },
      { onSuccess: resetForm }
    );
  };

  const handleAtualizar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    const isRecorrente = frequencia !== "Unico";
    const valorNum = valor ? parseFloat(valor.replace(",", ".")) : undefined;
    if (!valorNum || valorNum <= 0) { toast.error("Informe um valor válido"); return; }
    if (!categoria.trim()) { toast.error("Selecione uma categoria"); return; }
    if (!formaPagamento.trim()) { toast.error("Selecione a forma de pagamento"); return; }

    let vencimento = dataVencimento || undefined;
    if (frequencia === "Mensal" && diaRecorrente) {
      vencimento = getNextOccurrenceDate(parseInt(diaRecorrente));
    }
    atualizarLembrete.mutate(
      {
        id: editItem.id,
        data: {
          descricao: descricao.trim() || undefined,
          valor: valorNum,
          dataVencimento: vencimento,
          recorrenteMensal: isRecorrente,
          diaRecorrente: frequencia === "Mensal" && diaRecorrente ? parseInt(diaRecorrente) : undefined,
          frequencia: isRecorrente ? frequencia as FrequenciaLembrete : undefined,
          diaSemanaRecorrente: (frequencia === "Semanal" || frequencia === "Quinzenal") && diaSemana ? parseInt(diaSemana) : undefined,
          categoria: categoria.trim(),
          formaPagamento,
          lembreteTelegramAtivo,
          dataFimRecorrencia: isRecorrente && dataFimRecorrencia ? dataFimRecorrencia : (isRecorrente ? undefined : ""),
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
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2 h-10 px-5 rounded-xl shadow-premium font-semibold">
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
            <form onSubmit={handleCriar} className="px-5 sm:px-7 pb-8 space-y-4 sm:space-y-5">
              {/* Main fields */}
              <div className="space-y-4 rounded-2xl border border-border/40 bg-muted/15 p-4 sm:p-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Descrição</Label>
                  <Input placeholder="Ex: Aluguel, Internet, Energia..." value={descricao} onChange={(e) => setDescricao(e.target.value)} className="h-11 rounded-xl border-border/40 bg-background placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all" required />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor (R$)</Label>
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-11 sm:w-12 flex items-center justify-center rounded-l-xl text-sm font-bold bg-blue-500/10 text-blue-500">R$</div>
                    <Input placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} className="h-12 sm:h-14 rounded-xl pl-12 sm:pl-14 text-xl sm:text-2xl tabular-nums font-bold border-border/40 bg-background placeholder:text-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Categoria</Label>
                    <select
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                      className="h-11 w-full rounded-xl border border-border/40 bg-background px-3 text-sm"
                      required
                    >
                      <option value="">Selecione</option>
                      {categorias.map((cat) => (
                        <option key={cat.id} value={cat.nome}>{cat.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Forma de pagamento</Label>
                    <select
                      value={formaPagamento}
                      onChange={(e) => setFormaPagamento(e.target.value)}
                      className="h-11 w-full rounded-xl border border-border/40 bg-background px-3 text-sm"
                      required
                    >
                      <option value="">Selecione</option>
                      <option value="pix">PIX</option>
                      <option value="debito">Débito</option>
                      <option value="credito">Crédito</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Lembrete automático no Telegram</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setLembreteTelegramAtivo(true)}
                      className={cn(
                        "h-10 px-3 rounded-xl border text-sm font-medium",
                        lembreteTelegramAtivo ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400" : "border-border/40 text-muted-foreground"
                      )}
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => setLembreteTelegramAtivo(false)}
                      className={cn(
                        "h-10 px-3 rounded-xl border text-sm font-medium",
                        !lembreteTelegramAtivo ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400" : "border-border/40 text-muted-foreground"
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
                      onClick={() => setFrequencia(key)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 sm:gap-2 p-2.5 sm:p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer",
                        frequencia === key
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
                  {frequencia === "Unico" && (
                    <motion.div key="unico" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-1.5">
                      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Data do Pagamento</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                        <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="h-11 rounded-xl pl-10 border-border/40 bg-background focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all" />
                      </div>
                    </motion.div>
                  )}

                  {frequencia === "Mensal" && (
                    <motion.div key="mensal" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-2">
                      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Dia do vencimento no mês</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                        <Input type="number" min={1} max={31} placeholder="Ex: 10" value={diaRecorrente} onChange={(e) => setDiaRecorrente(e.target.value)} className="h-11 rounded-xl pl-10 border-border/40 bg-background placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all" />
                      </div>
                      <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5">
                        <Repeat className="h-3 w-3" />
                        {diaRecorrente ? `Pagamento todo dia ${diaRecorrente} de cada mês` : "Informe o dia para repetir todo mês"}
                      </p>
                    </motion.div>
                  )}

                  {(frequencia === "Semanal" || frequencia === "Quinzenal") && (
                    <motion.div key="semanal" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Dia da semana</Label>
                        <div className="grid grid-cols-7 gap-1">
                          {DIAS_SEMANA.map((dia, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setDiaSemana(String(idx))}
                              className={cn(
                                "p-1.5 sm:p-2 rounded-lg text-[10px] sm:text-xs font-medium transition-all cursor-pointer border",
                                diaSemana === String(idx)
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
                          <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="h-11 rounded-xl pl-10 border-border/40 bg-background focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all" />
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5">
                        <Repeat className="h-3 w-3" />
                        {frequencia === "Semanal" ? "Repete toda semana" : "Repete a cada 15 dias"}
                        {diaSemana ? ` (${DIAS_SEMANA[parseInt(diaSemana)]})` : ""}
                      </p>
                    </motion.div>
                  )}

                  {frequencia === "Anual" && (
                    <motion.div key="anual" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-2">
                      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Data do pagamento anual</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                        <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="h-11 rounded-xl pl-10 border-border/40 bg-background focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all" />
                      </div>
                      <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5">
                        <Repeat className="h-3 w-3" />
                        Repete uma vez por ano na mesma data
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Optional end date for recurring bills */}
              {frequencia !== "Unico" && (
                <div className="space-y-4 rounded-2xl border border-border/40 bg-muted/15 p-4 sm:p-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Até quando pagar? <span className="text-muted-foreground/40">(opcional)</span></Label>
                    <div className="relative">
                      <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                      <Input type="date" value={dataFimRecorrencia} onChange={(e) => setDataFimRecorrencia(e.target.value)} className="h-11 rounded-xl pl-10 border-border/40 bg-background focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all" />
                    </div>
                    <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5">
                      <CalendarClock className="h-3 w-3" />
                      {dataFimRecorrencia ? `Lembretes serão enviados até ${new Date(dataFimRecorrencia + "T12:00:00").toLocaleDateString("pt-BR")}` : "Se não informar, o lembrete continuará indefinidamente"}
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
          <form onSubmit={handleAtualizar} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor (R$)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} className="h-11 rounded-xl pl-9 tabular-nums" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categoria</Label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border/40 bg-background px-3 text-sm"
                  required
                >
                  <option value="">Selecione</option>
                  {categorias.map((cat) => (
                    <option key={cat.id} value={cat.nome}>{cat.nome}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Forma de pagamento</Label>
                <select
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border/40 bg-background px-3 text-sm"
                  required
                >
                  <option value="">Selecione</option>
                  <option value="pix">PIX</option>
                  <option value="debito">Débito</option>
                  <option value="credito">Crédito</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lembrete automático no Telegram</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLembreteTelegramAtivo(true)}
                  className={cn(
                    "h-10 px-3 rounded-xl border text-sm font-medium",
                    lembreteTelegramAtivo ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400" : "border-border/40 text-muted-foreground"
                  )}
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => setLembreteTelegramAtivo(false)}
                  className={cn(
                    "h-10 px-3 rounded-xl border text-sm font-medium",
                    !lembreteTelegramAtivo ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400" : "border-border/40 text-muted-foreground"
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
                    onClick={() => setFrequencia(key)}
                    className={cn(
                      "p-2 rounded-lg border-2 text-[11px] font-semibold transition-all duration-200 cursor-pointer",
                      frequencia === key
                        ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "border-border/40 hover:border-border/60 text-muted-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {frequencia === "Unico" && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data do Pagamento</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="h-11 rounded-xl pl-9" />
                </div>
              </div>
            )}

            {frequencia === "Mensal" && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dia do vencimento no mês</Label>
                <Input type="number" min={1} max={31} placeholder="Ex: 10" value={diaRecorrente} onChange={(e) => setDiaRecorrente(e.target.value)} className="h-11 rounded-xl" />
                <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                  <Repeat className="h-3 w-3" />
                  {diaRecorrente ? `Todo dia ${diaRecorrente} de cada mês` : "Informe o dia"}
                </p>
              </div>
            )}

            {(frequencia === "Semanal" || frequencia === "Quinzenal") && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dia da semana</Label>
                  <div className="grid grid-cols-7 gap-1">
                    {DIAS_SEMANA.map((dia, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setDiaSemana(String(idx))}
                        className={cn(
                          "p-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer border",
                          diaSemana === String(idx)
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
                    <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="h-11 rounded-xl pl-9" />
                  </div>
                </div>
              </div>
            )}

            {frequencia === "Anual" && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data do pagamento anual</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="h-11 rounded-xl pl-9" />
                </div>
              </div>
            )}

            {/* Optional end date for recurring bills */}
            {frequencia !== "Unico" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Até quando pagar? <span className="text-muted-foreground/40">(opcional)</span></Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input type="date" value={dataFimRecorrencia} onChange={(e) => setDataFimRecorrencia(e.target.value)} className="h-11 rounded-xl pl-9" />
                </div>
                <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" />
                  {dataFimRecorrencia ? `Até ${new Date(dataFimRecorrencia + "T12:00:00").toLocaleDateString("pt-BR")}` : "Sem data limite"}
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
