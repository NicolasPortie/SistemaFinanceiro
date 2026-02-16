"use client";

import { useState } from "react";
import {
  useMetas,
  useCategorias,
  useCriarMeta,
  useAtualizarMeta,
  useRemoverMeta,
} from "@/hooks/use-queries";
import type { CriarMetaRequest, MetaFinanceira } from "@/lib/api";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  Plus,
  Trash2,
  Edit3,
  Pause,
  Play,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Trophy,
  DollarSign,
  Calendar,
  Flag,
  Zap,
} from "lucide-react";
import {
  PageShell,
  PageHeader,
  StatCard,
  EmptyState,
  CardSkeleton,
} from "@/components/shared/page-components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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

const tiposLabel: Record<string, string> = {
  juntar_valor: "Juntar Valor",
  reduzir_gasto: "Reduzir Gasto",
  reserva_mensal: "Reserva Mensal",
};

const tiposIcon: Record<string, React.ReactNode> = {
  juntar_valor: <DollarSign className="h-4 w-4" />,
  reduzir_gasto: <TrendingDown className="h-4 w-4" />,
  reserva_mensal: <Zap className="h-4 w-4" />,
};

const prioridadeConfig: Record<string, { badge: string; color: string }> = {
  alta: { badge: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-red-200 dark:border-red-800", color: "text-red-500" },
  media: { badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200 dark:border-amber-800", color: "text-amber-500" },
  baixa: { badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-800", color: "text-blue-500" },
};

const desvioIcon = (desvio: string) => {
  if (desvio?.includes("adiantada")) return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (desvio?.includes("atrasada")) return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-amber-500" />;
};

function progressColor(pct: number) {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 70) return "bg-emerald-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-primary";
}

export default function MetasPage() {
  const { data: metas = [], isLoading: loading } = useMetas();
  const { data: categorias = [] } = useCategorias();
  const criarMeta = useCriarMeta();
  const atualizarMeta = useAtualizarMeta();
  const removerMeta = useRemoverMeta();

  const [showForm, setShowForm] = useState(false);

  // Create form state
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("juntar_valor");
  const [prioridade, setPrioridade] = useState("media");
  const [valorAlvo, setValorAlvo] = useState("");
  const [valorAtual, setValorAtual] = useState("");
  const [prazo, setPrazo] = useState("");
  const [categoria, setCategoria] = useState("");

  // Edit/Delete
  const [editMeta, setEditMeta] = useState<MetaFinanceira | null>(null);
  const [editValor, setEditValor] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const resetForm = () => {
    setNome(""); setTipo("juntar_valor"); setPrioridade("media");
    setValorAlvo(""); setValorAtual(""); setPrazo(""); setCategoria("");
  };

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    const alvo = parseFloat(valorAlvo.replace(",", "."));
    const atual = parseFloat(valorAtual.replace(",", ".") || "0");
    if (isNaN(alvo) || alvo <= 0) { toast.error("Informe um valor alvo válido"); return; }
    const data: CriarMetaRequest = {
      nome, tipo, valorAlvo: alvo, valorAtual: atual, prazo, prioridade,
      categoria: tipo === "reduzir_gasto" ? categoria : undefined,
    };
    criarMeta.mutate(data, {
      onSuccess: () => { resetForm(); setShowForm(false); },
    });
  };

  const handleAtualizar = async () => {
    if (!editMeta) return;
    const val = parseFloat(editValor.replace(",", "."));
    if (isNaN(val)) return;
    setActionLoading(editMeta.id);
    atualizarMeta.mutate(
      { id: editMeta.id, data: { valorAtual: val } },
      { onSuccess: () => setEditMeta(null), onSettled: () => setActionLoading(null) }
    );
  };

  const handlePausarResumir = async (meta: MetaFinanceira) => {
    setActionLoading(meta.id);
    const novoStatus = meta.status === "pausada" ? "ativa" : "pausada";
    atualizarMeta.mutate(
      { id: meta.id, data: { status: novoStatus } },
      { onSettled: () => setActionLoading(null) }
    );
  };

  const handleRemover = async () => {
    if (!deleteId) return;
    setActionLoading(deleteId);
    removerMeta.mutate(deleteId, {
      onSuccess: () => setDeleteId(null),
      onSettled: () => setActionLoading(null),
    });
  };

  const ativas = metas.filter((m) => m.status === "ativa");
  const pausadas = metas.filter((m) => m.status === "pausada");
  const concluidas = metas.filter((m) => m.status === "concluida");

  // Summary values
  const totalAlvo = ativas.reduce((s, m) => s + m.valorAlvo, 0);
  const totalAtual = ativas.reduce((s, m) => s + m.valorAtual, 0);
  const avgProgress = ativas.length > 0 ? Math.round(ativas.reduce((s, m) => s + m.percentualConcluido, 0) / ativas.length) : 0;

  return (
    <PageShell>
      {/* ── Page Header ── */}
      <PageHeader title="Metas Financeiras" description="Defina e acompanhe suas metas de economia e investimento">
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2 h-10 px-5 rounded-xl shadow-premium font-semibold">
          <Plus className="h-4 w-4" />
          Nova Meta
        </Button>
      </PageHeader>

      {/* ── Stats Overview ── */}
      {loading ? (
        <CardSkeleton count={4} />
      ) : (
        <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Ativas"
            value={ativas.length}
            icon={<Target className="h-5 w-5" />}
            trend="neutral"
            delay={0}
          />
          <StatCard
            title="Concluídas"
            value={concluidas.length}
            icon={<Trophy className="h-5 w-5" />}
            trend="up"
            delay={1}
          />
          <StatCard
            title="Progresso Médio"
            value={`${avgProgress}%`}
            icon={<TrendingUp className="h-5 w-5" />}
            trend={avgProgress >= 50 ? "up" : avgProgress > 0 ? "neutral" : "down"}
            delay={2}
          />
          <StatCard
            title="Total Guardado"
            value={formatCurrency(totalAtual)}
            subtitle={`de ${formatCurrency(totalAlvo)} total`}
            icon={<DollarSign className="h-5 w-5" />}
            trend="up"
            delay={3}
          />
        </div>
      )}

      {/* ── Active Goals ── */}
      {ativas.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Metas Ativas</h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence>
              {ativas.map((meta, i) => (
                <MetaCard
                  key={meta.id}
                  meta={meta}
                  index={i}
                  actionLoading={actionLoading}
                  onEdit={() => { setEditMeta(meta); setEditValor(meta.valorAtual.toString()); }}
                  onPausar={() => handlePausarResumir(meta)}
                  onRemover={() => setDeleteId(meta.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── Paused Goals ── */}
      {pausadas.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Pausadas</h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pausadas.map((meta, i) => (
              <MetaCard
                key={meta.id}
                meta={meta}
                index={i}
                actionLoading={actionLoading}
                onEdit={() => { setEditMeta(meta); setEditValor(meta.valorAtual.toString()); }}
                onPausar={() => handlePausarResumir(meta)}
                onRemover={() => setDeleteId(meta.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Completed Goals ── */}
      {concluidas.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Concluídas</h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {concluidas.map((meta, i) => (
              <motion.div key={meta.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card-premium p-5 group">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{meta.nome}</p>
                    <p className="text-[11px] text-muted-foreground/60 font-medium tabular-nums">{formatCurrency(meta.valorAlvo)}</p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-0 font-semibold text-[10px]">
                    Concluída
                  </Badge>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {metas.length === 0 && !loading && (
        <EmptyState
          icon={<Target className="h-6 w-6" />}
          title="Nenhuma meta"
          description="Crie sua primeira meta financeira para começar a acompanhar seu progresso"
          action={
            <Button onClick={() => setShowForm(true)} className="gap-2 shadow-premium">
              <Plus className="h-4 w-4" /> Criar meta
            </Button>
          }
        />
      )}

      {/* ── New Goal Sheet ── */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-6">
            <SheetTitle className="text-xl font-extrabold tracking-tight">Nova Meta</SheetTitle>
            <SheetDescription className="text-muted-foreground/70">Defina uma meta financeira para acompanhar</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCriar} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome da Meta</Label>
              <Input placeholder="Ex: Reserva de emergência" value={nome} onChange={(e) => setNome(e.target.value)} required className="h-11 rounded-xl" />
            </div>

            {/* Type selector */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["juntar_valor", "reduzir_gasto", "reserva_mensal"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={`flex flex-col items-center gap-2 py-3.5 px-2 rounded-2xl text-xs font-bold transition-all duration-300 cursor-pointer ${tipo === t ? "bg-primary/10 text-primary border-2 border-primary/30 shadow-md shadow-primary/5 scale-[1.02]" : "bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border/40 hover:border-border/60"}`}
                  >
                    {tiposIcon[t]}
                    {tiposLabel[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prioridade</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["baixa", "media", "alta"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPrioridade(p)}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-300 cursor-pointer ${prioridade === p ? `${prioridadeConfig[p].badge} border-2 shadow-sm` : "bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border/40 hover:border-border/60"}`}
                  >
                    <Flag className={`h-3 w-3 ${prioridade === p ? prioridadeConfig[p].color : ""}`} />
                    {p === "baixa" ? "Baixa" : p === "media" ? "Média" : "Alta"}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Values */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor Alvo (R$)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input placeholder="0,00" value={valorAlvo} onChange={(e) => setValorAlvo(e.target.value)} required className="h-11 rounded-xl pl-9 tabular-nums font-semibold" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Já guardado (R$)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input placeholder="0,00" value={valorAtual} onChange={(e) => setValorAtual(e.target.value)} className="h-11 rounded-xl pl-9 tabular-nums font-semibold" />
                </div>
              </div>
            </div>

            {/* Deadline */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prazo</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} required className="h-11 rounded-xl pl-9" />
              </div>
            </div>

            {/* Category (for "reduzir_gasto") */}
            <AnimatePresence>
              {tipo === "reduzir_gasto" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categoria</Label>
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                    <SelectContent>{categorias.map((c) => (<SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>))}</SelectContent>
                  </Select>
                </motion.div>
              )}
            </AnimatePresence>

            <Separator />

            <Button type="submit" className="w-full h-13 rounded-2xl gap-2.5 font-bold text-[15px] shadow-premium btn-premium" disabled={criarMeta.isPending}>
              {criarMeta.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Target className="h-4 w-4" />Criar Meta</>}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* ── Edit Value Dialog ── */}
      <Dialog open={editMeta !== null} onOpenChange={() => setEditMeta(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Atualizar valor</DialogTitle>
            <DialogDescription>Informe o novo valor atual da meta &quot;{editMeta?.nome}&quot;</DialogDescription>
          </DialogHeader>
          {editMeta && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/30">
              <div className="relative h-12 w-12 shrink-0">
                <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
                  <circle cx="24" cy="24" r="18" fill="none" strokeWidth="4" strokeLinecap="round" className={progressColor(editMeta.percentualConcluido)} stroke="currentColor" strokeDasharray={`${Math.min(editMeta.percentualConcluido, 100) * 1.131} 113.1`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-extrabold tabular-nums">{editMeta.percentualConcluido.toFixed(0)}%</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{editMeta.nome}</p>
                <p className="text-[11px] text-muted-foreground/60 tabular-nums font-medium">Alvo: {formatCurrency(editMeta.valorAlvo)}</p>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor Atual (R$)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <Input value={editValor} onChange={(e) => setEditValor(e.target.value)} className="h-11 rounded-xl pl-9 tabular-nums font-semibold" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMeta(null)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleAtualizar} disabled={actionLoading === editMeta?.id} className="gap-2 rounded-xl shadow-premium font-semibold">
              {actionLoading === editMeta?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" /> }
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover meta?</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja remover esta meta? Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemover} disabled={actionLoading === deleteId} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl gap-2">
              {actionLoading === deleteId ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4" />Remover</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

// ── Meta Card Component ──
function MetaCard({
  meta,
  index,
  actionLoading,
  onEdit,
  onPausar,
  onRemover,
}: {
  meta: MetaFinanceira;
  index: number;
  actionLoading: number | null;
  onEdit: () => void;
  onPausar: () => void;
  onRemover: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="card-premium group transition-all hover:shadow-lg hover:-translate-y-0.5 duration-300"
    >
      {/* Header */}
      <div className="p-5 pb-0">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-bold tracking-tight text-sm">{meta.nome}</h4>
            <Badge variant="outline" className={`text-[10px] font-semibold ${prioridadeConfig[meta.prioridade]?.badge ?? ""}`}>
              {meta.prioridade}
            </Badge>
          </div>
          <div className="flex items-center gap-0.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={onEdit}><Edit3 className="h-3.5 w-3.5" /></Button>
                </TooltipTrigger>
                <TooltipContent>Atualizar valor</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={onPausar} disabled={actionLoading === meta.id}>
                    {meta.status === "pausada" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{meta.status === "pausada" ? "Retomar" : "Pausar"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onRemover}><Trash2 className="h-3.5 w-3.5" /></Button>
                </TooltipTrigger>
                <TooltipContent>Remover</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60 font-medium flex-wrap mb-4">
          <span className="flex items-center gap-1">{tiposIcon[meta.tipo]}{tiposLabel[meta.tipo] || meta.tipo}</span>
          {meta.categoriaNome && (<><span>·</span><span>{meta.categoriaNome}</span></>)}
          <span>·</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatShortDate(meta.prazo)}</span>
        </div>
      </div>

      {/* Progress visual */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-4 mb-3">
          <div className="relative h-14 w-14 shrink-0">
            <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" strokeWidth="4.5" className="text-muted/30" />
              <circle
                cx="28" cy="28" r="22" fill="none"
                strokeWidth="4.5" strokeLinecap="round"
                className={progressColor(meta.percentualConcluido)}
                stroke="currentColor"
                strokeDasharray={`${Math.min(meta.percentualConcluido, 100) * 1.382} 138.2`}
                style={{ transition: "stroke-dasharray 1s ease-out" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-extrabold tabular-nums">{meta.percentualConcluido.toFixed(0)}%</span>
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground/70 font-medium">Atual</span>
              <span className="font-bold tabular-nums">{formatCurrency(meta.valorAtual)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground/70 font-medium">Meta</span>
              <span className="font-bold tabular-nums">{formatCurrency(meta.valorAlvo)}</span>
            </div>
          </div>
        </div>

        <Progress value={Math.min(meta.percentualConcluido, 100)} className="h-1.5 mb-3" />
      </div>

      {/* Footer info */}
      <div className="px-5 py-3 border-t border-border/30 bg-muted/10 rounded-b-2xl">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60 font-medium flex-wrap">
          <span className="flex items-center gap-1">{desvioIcon(meta.desvio)}{meta.desvio}</span>
          <Separator orientation="vertical" className="h-3.5" />
          <span className="tabular-nums">{formatCurrency(meta.valorMensalNecessario)}/mês</span>
          <Separator orientation="vertical" className="h-3.5" />
          <span>{meta.mesesRestantes} {meta.mesesRestantes === 1 ? "mês" : "meses"}</span>
        </div>
      </div>
    </motion.div>
  );
}
