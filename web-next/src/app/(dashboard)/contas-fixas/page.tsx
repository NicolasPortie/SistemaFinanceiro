"use client";

import { useState, useMemo } from "react";
import {
  useLembretes,
  useCriarLembrete,
  useAtualizarLembrete,
  useDesativarLembrete,
} from "@/hooks/use-queries";
import { formatCurrency, formatShortDate } from "@/lib/format";
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
  EmptyState,
  ErrorState,
  CardSkeleton,
} from "@/components/shared/page-components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

function getStatusInfo(dataVenc: string) {
  if (isVencido(dataVenc)) return { label: "Vencido", color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-500/15", icon: AlertCircle, badgeClass: "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10" };
  if (isProximo(dataVenc)) return { label: "Próximo", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-500/15", icon: AlertTriangle, badgeClass: "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10" };
  return { label: "Em dia", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-500/15", icon: CheckCircle2, badgeClass: "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10" };
}

export default function ContasFixasPage() {
  const { data: lembretes = [], isLoading, isError, error, refetch } = useLembretes();
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
  const [recorrente, setRecorrente] = useState(false);
  const [diaRecorrente, setDiaRecorrente] = useState("");

  const resetForm = () => {
    setDescricao("");
    setValor("");
    setDataVencimento("");
    setRecorrente(false);
    setDiaRecorrente("");
    setShowForm(false);
    setEditItem(null);
  };

  const openEdit = (lembrete: LembretePagamento) => {
    setEditItem(lembrete);
    setDescricao(lembrete.descricao);
    setValor(lembrete.valor?.toString() ?? "");
    setDataVencimento(lembrete.dataVencimento);
    setRecorrente(lembrete.recorrenteMensal);
    setDiaRecorrente(lembrete.diaRecorrente?.toString() ?? "");
  };

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim()) { toast.error("Informe a descrição"); return; }
    if (!dataVencimento) { toast.error("Informe a data de vencimento"); return; }
    const valorNum = valor ? parseFloat(valor.replace(",", ".")) : undefined;
    criarLembrete.mutate(
      { descricao: descricao.trim(), valor: valorNum, dataVencimento, recorrenteMensal: recorrente, diaRecorrente: recorrente && diaRecorrente ? parseInt(diaRecorrente) : undefined },
      { onSuccess: resetForm }
    );
  };

  const handleAtualizar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    const valorNum = valor ? parseFloat(valor.replace(",", ".")) : undefined;
    atualizarLembrete.mutate(
      { id: editItem.id, data: { descricao: descricao.trim() || undefined, valor: valorNum, dataVencimento: dataVencimento || undefined, recorrenteMensal: recorrente, diaRecorrente: recorrente && diaRecorrente ? parseInt(diaRecorrente) : undefined } },
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
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Contas Fixas</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie seus lembretes de pagamento e contas recorrentes</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex items-center gap-2 mt-3 sm:mt-0">
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
        </motion.div>
      </div>

      {/* ── Stats Overview ── */}
      {isLoading ? (
        <CardSkeleton count={4} />
      ) : isError ? (
        <ErrorState message={error?.message} onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-premium p-5 group">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Total Contas</p>
                <p className="text-2xl font-extrabold tabular-nums tracking-tight">{stats.count}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-500 group-hover:scale-110">
                <FileText className="h-5 w-5" />
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card-premium p-5 group">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Valor Total</p>
                <p className="text-2xl font-extrabold tabular-nums tracking-tight text-primary">{formatCurrency(stats.total)}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-500 group-hover:scale-110">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card-premium p-5 group">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Vencidos</p>
                <p className={`text-2xl font-extrabold tabular-nums tracking-tight ${stats.vencidos > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>{stats.vencidos}</p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-500 group-hover:scale-110 ${stats.vencidos > 0 ? "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"}`}>
                <AlertCircle className="h-5 w-5" />
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card-premium p-5 group">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Próximos</p>
                <p className={`text-2xl font-extrabold tabular-nums tracking-tight ${stats.proximos > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>{stats.proximos}</p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-500 group-hover:scale-110 ${stats.proximos > 0 ? "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" : "bg-muted/50 text-muted-foreground"}`}>
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </motion.div>
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    filtroStatus === f.key
                      ? f.color
                        ? `${f.color} text-white shadow-sm`
                        : "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {activeFilters > 0 && (
              <button onClick={() => { setFiltroStatus("todos"); setBusca(""); }} className="ml-1 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
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
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${status.bg} ${status.color} transition-transform duration-300 group-hover:scale-105`}>
                          <StatusIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold truncate">{l.descricao}</p>
                          {l.recorrenteMensal && (
                            <p className="text-[11px] text-muted-foreground/60 font-medium flex items-center gap-1">
                              <Repeat className="h-3 w-3" />
                              {l.diaRecorrente ? `Dia ${l.diaRecorrente}` : "Mensal"}
                            </p>
                          )}
                        </div>
                      </div>

                      <span className="text-[13px] font-bold tabular-nums">{l.valor != null ? formatCurrency(l.valor) : "—"}</span>

                      <span className="text-[13px] text-muted-foreground/80 font-medium tabular-nums">{formatShortDate(l.dataVencimento)}</span>

                      <Badge variant="outline" className={`text-[11px] font-semibold w-fit ${status.badgeClass}`}>
                        {status.label}
                      </Badge>

                      <div className="flex items-center justify-end gap-0.5 w-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
                          {l.recorrenteMensal && (
                            <>
                              <span className="text-[11px] text-muted-foreground/40">·</span>
                              <span className="text-[11px] text-muted-foreground/60 font-medium flex items-center gap-0.5">
                                <Repeat className="h-2.5 w-2.5" />Mensal
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
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-6">
            <SheetTitle className="text-xl font-bold">Novo Lembrete</SheetTitle>
            <SheetDescription>Adicione um lembrete de pagamento ou conta fixa</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCriar} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</Label>
              <Input placeholder="Ex: Aluguel, Internet, Energia..." value={descricao} onChange={(e) => setDescricao(e.target.value)} className="h-11 rounded-xl" required />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor (R$)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input placeholder="0,00 (opcional)" value={valor} onChange={(e) => setValor(e.target.value)} className="h-11 rounded-xl pl-9 text-lg tabular-nums font-semibold" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data de Vencimento</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="h-11 rounded-xl pl-9" required />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/30">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Repeat className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Recorrente mensal</p>
                  <p className="text-[11px] text-muted-foreground/60">Repetir pagamento todo mês</p>
                </div>
              </div>
              <Switch checked={recorrente} onCheckedChange={setRecorrente} />
            </div>

            {recorrente && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dia de vencimento (1-31)</Label>
                <Input type="number" min={1} max={31} placeholder="Dia" value={diaRecorrente} onChange={(e) => setDiaRecorrente(e.target.value)} className="h-11 rounded-xl" />
              </motion.div>
            )}

            <Separator />

            <Button type="submit" className="w-full h-12 rounded-xl gap-2 font-bold text-sm shadow-premium" disabled={criarLembrete.isPending}>
              {criarLembrete.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Criar Lembrete
                </>
              )}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* ── Edit Dialog ── */}
      <Dialog open={editItem !== null} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Editar Lembrete</DialogTitle>
            <DialogDescription>Altere os dados do lembrete</DialogDescription>
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
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data de Vencimento</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="h-11 rounded-xl pl-9" />
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/20 border border-border/30">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-muted-foreground" />
                <Label className="cursor-pointer text-sm font-medium">Recorrente mensal</Label>
              </div>
              <Switch checked={recorrente} onCheckedChange={setRecorrente} />
            </div>

            {recorrente && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dia de vencimento (1-31)</Label>
                <Input type="number" min={1} max={31} value={diaRecorrente} onChange={(e) => setDiaRecorrente(e.target.value)} className="h-11 rounded-xl" />
              </div>
            )}

            <Button type="submit" className="w-full h-11 rounded-xl gap-2 font-bold shadow-premium" disabled={atualizarLembrete.isPending}>
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
