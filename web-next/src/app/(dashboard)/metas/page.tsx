"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  useMetas,
  useCategorias,
  useCriarMeta,
  useAtualizarMeta,
  useRemoverMeta,
} from "@/hooks/use-queries";
import type { CriarMetaRequest, MetaFinanceira } from "@/lib/api";
import { formatCurrency, formatShortDate } from "@/lib/format";
import {
  metaSchema,
  atualizarMetaSchema,
  type MetaData,
  type AtualizarMetaData,
} from "@/lib/schemas";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  Plus,
  Trash2,
  Edit3,
  Pause,
  Play,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  DollarSign,
  Calendar,
  Flag,
  Zap,
  RefreshCw,
  MoreVertical,
} from "lucide-react";
import { EmptyState, ErrorState, CardSkeleton } from "@/components/shared/page-components";
import { DialogShellHeader } from "@/components/shared/dialog-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";

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
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Helpers ────────────────────────────────────────────────
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
  alta: {
    badge:
      "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-red-200 dark:border-red-800",
    color: "text-red-500",
  },
  media: {
    badge:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    color: "text-amber-500",
  },
  baixa: {
    badge:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    color: "text-emerald-500",
  },
};

const desvioIcon = (desvio: string) => {
  if (desvio?.includes("adiantada")) return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (desvio?.includes("atrasada")) return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-amber-500" />;
};

function progressColor(pct: number) {
  if (pct >= 100) return "text-emerald-500";
  if (pct >= 70) return "text-emerald-500";
  if (pct >= 40) return "text-amber-500";
  return "text-emerald-600";
}

function progressStrokeColor(pct: number) {
  if (pct >= 100) return "stroke-emerald-500";
  if (pct >= 70) return "stroke-emerald-500";
  if (pct >= 40) return "stroke-amber-500";
  return "stroke-emerald-600";
}

const statusConfig: Record<string, { label: string; badgeClass: string }> = {
  ativa: {
    label: "Ativa",
    badgeClass:
      "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  },
  pausada: {
    label: "Pausada",
    badgeClass:
      "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  },
  concluida: {
    label: "Concluída",
    badgeClass:
      "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  },
};

export default function MetasPage() {
  const { data: metas = [], isLoading: loading, isError, error, refetch } = useMetas();
  const { data: categorias = [] } = useCategorias();
  const criarMeta = useCriarMeta();
  const atualizarMeta = useAtualizarMeta();
  const removerMeta = useRemoverMeta();

  const [showForm, setShowForm] = useState(false);
  const [editMeta, setEditMeta] = useState<MetaFinanceira | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Create form
  const createForm = useForm<MetaData>({
    resolver: zodResolver(metaSchema),
    defaultValues: {
      nome: "",
      tipo: "juntar_valor",
      prioridade: "media",
      valorAlvo: "",
      valorAtual: "",
      prazo: "",
      categoria: "",
    },
  });
  const tipo = createForm.watch("tipo");
  const prioridade = createForm.watch("prioridade");

  // Edit form
  const editForm = useForm<AtualizarMetaData>({
    resolver: zodResolver(atualizarMetaSchema),
    defaultValues: { valorAtual: "" },
  });

  const handleCriar = (data: MetaData) => {
    const alvo = parseFloat(data.valorAlvo.replace(",", "."));
    const atual = parseFloat((data.valorAtual || "").replace(",", ".") || "0");
    const req: CriarMetaRequest = {
      nome: data.nome,
      tipo: data.tipo,
      valorAlvo: alvo,
      valorAtual: atual,
      prazo: data.prazo,
      prioridade: data.prioridade,
      categoria: data.tipo === "reduzir_gasto" ? data.categoria : undefined,
    };
    criarMeta.mutate(req, {
      onSuccess: () => {
        createForm.reset();
        setShowForm(false);
      },
    });
  };

  const handleAtualizar = (data: AtualizarMetaData) => {
    if (!editMeta) return;
    const val = parseFloat(data.valorAtual.replace(",", "."));
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

  const totalAlvo = ativas.reduce((s, m) => s + m.valorAlvo, 0);
  const totalAtual = ativas.reduce((s, m) => s + m.valorAtual, 0);
  const globalPct = totalAlvo > 0 ? Math.round((totalAtual / totalAlvo) * 100) : 0;

  const totalMensal = ativas.reduce((s, m) => s + m.valorMensalNecessario, 0);

  // calendar: which months (0=Jan…11=Dec) are "contributed" based on criadoEm
  function getCalendar(criadoEm: string): boolean[] {
    const start = new Date(criadoEm);
    const now = new Date();
    const year = now.getFullYear();
    return Array.from({ length: 12 }, (_, i) => {
      const monthEnd = new Date(year, i + 1, 0);
      return start <= monthEnd && new Date(year, i, 1) <= now;
    });
  }

  const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* ── Page Header & Summary Cards ──────────────────────────── */}
      <div className="flex items-end justify-between flex-wrap gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl serif-italic text-[#0F172A] mb-2">Metas</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">Gerenciamento Estratégico de Capitais</p>
        </div>
        <div className="flex gap-3 sm:gap-4 flex-wrap items-center w-full sm:w-auto">
          <div className="exec-card px-4 sm:px-6 py-3 sm:py-4 rounded-2xl flex flex-col flex-1 sm:flex-none sm:min-w-[170px]">
            <p className="text-[8px] text-slate-400 uppercase font-bold tracking-widest mb-1">Total Acumulado</p>
            <p className="text-sm mono-data font-bold text-[#0F172A]">{formatCurrency(totalAtual)}</p>
          </div>
          <div className="exec-card px-4 sm:px-6 py-3 sm:py-4 rounded-2xl flex flex-col flex-1 sm:flex-none sm:min-w-[170px]">
            <p className="text-[8px] text-slate-400 uppercase font-bold tracking-widest mb-1">Total Projetado</p>
            <p className="text-sm mono-data font-bold text-[#0F172A]">{formatCurrency(totalAlvo)}</p>
          </div>
          <div className="exec-card px-4 sm:px-6 py-3 sm:py-4 rounded-2xl flex flex-col flex-1 sm:flex-none sm:min-w-[170px]">
            <p className="text-[8px] text-slate-400 uppercase font-bold tracking-widest mb-1">Economia Mensal</p>
            <p className="text-sm mono-data font-bold text-[#0F172A]">{formatCurrency(totalMensal)}<span className="text-slate-400 font-normal">/mês</span></p>
          </div>
          <button
            onClick={() => { createForm.reset(); setShowForm(true); }}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 sm:px-6 py-3 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 w-full sm:w-auto justify-center"
          >
            <Plus className="h-4 w-4" />
            Nova Meta
          </button>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────── */}
      {loading ? (
        <CardSkeleton count={4} />
      ) : isError ? (
        <ErrorState message={error?.message ?? "Erro ao carregar metas"} onRetry={refetch} />
      ) : metas.length === 0 ? (
        <div className="exec-card rounded-2xl sm:rounded-[2.5rem] p-6 sm:p-12">
          <EmptyState
            icon={<Target className="h-6 w-6" />}
            title="Nenhuma meta"
            description="Crie sua primeira meta financeira para começar a acompanhar seu progresso"
            action={
              <button
                onClick={() => { createForm.reset(); setShowForm(true); }}
                className="bg-emerald-600 text-white px-5 py-2.5 rounded-2xl font-medium shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer text-sm"
              >
                <Plus className="h-4 w-4" />
                Criar meta
              </button>
            }
          />
        </div>
      ) : (
        <div className="exec-card rounded-2xl sm:rounded-[2.5rem] overflow-hidden flex flex-col">
          {/* Desktop Table header — hidden on mobile */}
          <div className="hidden lg:grid p-6 xl:p-10 border-b border-slate-50 grid-cols-12 gap-6 text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] items-center">
            <div className="col-span-3">Objetivo Estratégico</div>
            <div className="col-span-2">Real vs. Velocity</div>
            <div className="col-span-2">Acúmulo / Meta</div>
            <div className="col-span-2">Tendência</div>
            <div className="col-span-1 text-center">Status</div>
            <div className="col-span-2 text-right pr-4">Ações</div>
          </div>

          {/* Mobile card view */}
          <div className="lg:hidden divide-y divide-slate-50">
            {metas.map((meta) => {
              const pct = Math.min(meta.percentualConcluido, 100);
              const isConcluida = meta.status === "concluida";
              const isPausada = meta.status === "pausada";
              const isAtrasada = meta.desvio?.toLowerCase().includes("atrasada");
              const isAdiantada = meta.desvio?.toLowerCase().includes("adiantada");
              let pillLabel = "No Prazo";
              let pillCls = "bg-emerald-50 text-emerald-600";
              let accentColor = "text-emerald-600";
              let barStroke = "bg-emerald-500";
              if (isConcluida) { pillLabel = "Concluída"; pillCls = "bg-emerald-50 text-emerald-600"; }
              else if (isPausada) { pillLabel = "Pausada"; pillCls = "bg-amber-50 text-amber-600"; accentColor = "text-amber-600"; barStroke = "bg-amber-400"; }
              else if (isAtrasada) { pillLabel = "Atrasada"; pillCls = "bg-rose-50 text-rose-600"; accentColor = "text-rose-600"; barStroke = "bg-rose-500"; }
              else if (isAdiantada) { pillLabel = "Adiantada"; pillCls = "bg-indigo-50 text-indigo-600"; accentColor = "text-indigo-600"; barStroke = "bg-indigo-500"; }
              let deltaText = "";
              if (isConcluida) deltaText = "META ATINGIDA!";
              else if (isAtrasada) deltaText = `DÉFICIT DE ${formatCurrency(meta.valorAlvo - meta.valorAtual)}`;
              else if (meta.mesesRestantes > 0) deltaText = `FALTAM ${meta.mesesRestantes} ${meta.mesesRestantes === 1 ? "MÊS" : "MESES"}`;

              return (
                <div key={meta.id} className="p-4 sm:p-6 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                        <Target className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[#0F172A] truncate">{meta.nome}</h3>
                        {deltaText && <p className={`text-[8px] font-bold mt-0.5 ${accentColor}`}>{deltaText}</p>}
                      </div>
                    </div>
                    <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-md whitespace-nowrap ${pillCls}`}>
                      {pillLabel}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500 font-medium">{formatCurrency(meta.valorAtual)} / {formatCurrency(meta.valorAlvo)}</span>
                      <span className={`font-bold ${accentColor}`}>{pct}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${barStroke} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    {!isConcluida && (
                      <button
                        onClick={() => { setEditMeta(meta); editForm.reset({ valorAtual: meta.valorAtual.toFixed(2).replace(".", ",") }); }}
                        className="text-emerald-600 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Aportar
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteId(meta.id)}
                      className="text-slate-400 hover:text-rose-600 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ml-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Rows — hidden on mobile */}
          <div className="hidden lg:block divide-y divide-slate-50">
            {metas.map((meta) => {
              const pct = Math.min(meta.percentualConcluido, 100);
              // Projected % based on timeline
              const prazoDate = new Date(meta.prazo);
              const startDate = new Date(meta.criadoEm);
              const totalMs = prazoDate.getTime() - startDate.getTime();
              const elapsedMs = Date.now() - startDate.getTime();
              const projPct = totalMs > 0 ? Math.min(Math.round((elapsedMs / totalMs) * 100), 100) : 0;

              // Status pill
              const isAdiantada = meta.desvio?.toLowerCase().includes("adiantada");
              const isAtrasada = meta.desvio?.toLowerCase().includes("atrasada");
              const isConcluida = meta.status === "concluida";
              const isPausada = meta.status === "pausada";
              let pillLabel = "No Prazo";
              let pillCls = "bg-emerald-50 text-emerald-600";
              let accentColor = "text-emerald-600";
              let barStroke = "bg-emerald-500";
              let svgStroke = "#10B981";
              if (isConcluida) {
                pillLabel = "Concluída"; pillCls = "bg-emerald-50 text-emerald-600";
                accentColor = "text-emerald-600"; barStroke = "bg-emerald-500"; svgStroke = "#10B981";
              } else if (isPausada) {
                pillLabel = "Pausada"; pillCls = "bg-amber-50 text-amber-600";
                accentColor = "text-amber-600"; barStroke = "bg-amber-400"; svgStroke = "#F59E0B";
              } else if (isAtrasada) {
                pillLabel = "Atrasada"; pillCls = "bg-rose-50 text-rose-600";
                accentColor = "text-rose-600"; barStroke = "bg-rose-500"; svgStroke = "#F43F5E";
              } else if (isAdiantada) {
                pillLabel = "Adiantada"; pillCls = "bg-indigo-50 text-indigo-600";
                accentColor = "text-indigo-600"; barStroke = "bg-indigo-500"; svgStroke = "#6366F1";
              }

              // Sub-delta text
              let deltaText = "";
              if (isConcluida) {
                deltaText = "META ATINGIDA!";
              } else if (isAtrasada) {
                deltaText = `DÉFICIT DE ${formatCurrency(meta.valorAlvo - meta.valorAtual)}`;
              } else if (isAdiantada && meta.mesesRestantes > 0) {
                deltaText = `CONCLUSÃO EM ${meta.mesesRestantes} ${meta.mesesRestantes === 1 ? "MÊS" : "MESES"}`;
              } else if (meta.mesesRestantes > 0) {
                deltaText = `FALTAM ${meta.mesesRestantes} ${meta.mesesRestantes === 1 ? "MÊS" : "MESES"}`;
              }

              // Sparkline path
              const sparkPath = isAtrasada
                ? "M0,5 L20,10 L40,12 L60,14 L80,15 L100,16 L120,18"
                : isAdiantada
                  ? "M0,28 L20,22 L40,16 L60,12 L80,7 L100,4 L120,2"
                  : "M0,25 L20,22 L40,20 L60,17 L80,13 L100,10 L120,7";

              // Calendar squares
              const calendar = getCalendar(meta.criadoEm);

              return (
                <div key={meta.id} className="grid grid-cols-12 gap-6 p-6 xl:p-10 items-center hover:bg-slate-50/50 transition-colors group">
                  {/* Objetivo */}
                  <div className="col-span-3 flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors shrink-0">
                      <Target className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-[#0F172A] mb-2 truncate">{meta.nome}</h3>
                      <div className="flex flex-col gap-1">
                        <span className="text-[7px] text-slate-400 font-bold uppercase tracking-widest">Calendário de Aportes</span>
                        <div className="flex gap-1.5 flex-wrap">
                          {MONTH_LABELS.map((label, i) => (
                            <div key={i} className="flex flex-col items-center gap-0.5">
                              <div className={`w-3.5 h-3.5 rounded-sm ${calendar[i] ? "bg-emerald-500" : "border border-slate-200 bg-transparent"}`} />
                              <span className="text-[7px] font-bold text-slate-400 uppercase">{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Velocity */}
                  <div className="col-span-2 space-y-2">
                    <div className="flex justify-between text-[8px] font-bold uppercase tracking-tighter mb-1">
                      <span className={accentColor}>ATUAL: {pct}%</span>
                      <span className="text-slate-400">PROJ: {projPct}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full relative overflow-hidden">
                      <div className={`absolute top-0 left-0 h-[2px] ${barStroke} rounded-full z-10`} style={{ width: `${pct}%` }} />
                      <div className="absolute bottom-0 left-0 h-[2px] bg-slate-300 rounded-full opacity-50" style={{ width: `${projPct}%` }} />
                    </div>
                  </div>

                  {/* Acúmulo / Meta */}
                  <div className="col-span-2">
                    <p className="text-xs mono-data font-bold text-[#0F172A]">
                      {formatCurrency(meta.valorAtual)}{" "}
                      <span className="text-slate-300 font-light mx-0.5">/</span>{" "}
                      {formatCurrency(meta.valorAlvo)}
                    </p>
                    {deltaText && (
                      <p className={`text-[8px] font-bold mt-1 ${accentColor}`}>{deltaText}</p>
                    )}
                  </div>

                  {/* Tendência sparkline */}
                  <div className="col-span-2">
                    <p className="text-[7px] font-bold text-slate-400 mb-1 uppercase tracking-widest truncate">
                      {meta.desvio || "Tendência estável"}
                    </p>
                    <svg className="w-full h-8" viewBox="0 0 120 30">
                      <path d={sparkPath} fill="none" stroke={svgStroke} strokeLinecap="round" strokeWidth="1.5" />
                    </svg>
                  </div>

                  {/* Status pill */}
                  <div className="col-span-1 flex justify-center">
                    <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-md min-w-[85px] text-center ${pillCls}`}>
                      {pillLabel}
                    </span>
                  </div>

                  {/* Ações */}
                  <div className="col-span-2 flex justify-end gap-8 text-[9px] font-bold uppercase tracking-widest pr-4">
                    {!isConcluida && (
                      <button
                        onClick={() => { setEditMeta(meta); editForm.reset({ valorAtual: meta.valorAtual.toFixed(2).replace(".", ",") }); }}
                        className="text-emerald-600 hover:brightness-90 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Aportar
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteId(meta.id)}
                      className="text-slate-400 hover:text-rose-600 transition-all flex items-center gap-1.5 cursor-pointer opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-6 lg:p-8 border-t border-slate-50 bg-slate-50/20 flex items-center justify-between flex-wrap gap-4">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
              {metas.length} meta{metas.length !== 1 ? "s" : ""} ativas • {ativas.length} ativa{ativas.length !== 1 ? "s" : ""}, {concluidas.length} concluída{concluidas.length !== 1 ? "s" : ""}
            </p>
            <div className="flex gap-4 flex-wrap">
              {pausadas.length > 0 && (
                <span className="px-5 py-2.5 rounded-xl bg-amber-50 border border-amber-100 text-[9px] font-bold text-amber-600 uppercase tracking-widest">
                  {pausadas.length} pausada{pausadas.length !== 1 ? "s" : ""}
                </span>
              )}
              <button
                onClick={() => { createForm.reset(); setShowForm(true); }}
                className="px-6 py-3 rounded-xl bg-slate-900 text-white text-[9px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 cursor-pointer flex items-center gap-2"
              >
                <Plus className="h-3.5 w-3.5" />
                Nova Meta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ New Goal Dialog ═══ */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-emerald-600/[0.08] bg-emerald-600/[0.03] p-3.5 sm:p-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-emerald-600/15 text-emerald-600 shadow-sm shadow-emerald-500/10 transition-all duration-500">
                <Target className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-semibold">Nova Meta</DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs sm:text-[13px] mt-0.5 truncate">
                  Defina uma meta financeira para acompanhar
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            <form
              onSubmit={createForm.handleSubmit(handleCriar)}
              className="space-y-4 sm:space-y-5"
            >
              {/* Main fields */}
              <div className="space-y-4 rounded-2xl border border-emerald-600/[0.08] dark:border-slate-700/40 bg-white dark:bg-slate-800/60 shadow-[0_1px_6px_rgba(16,185,129,0.06)] dark:shadow-none p-4 sm:p-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Nome da Meta
                  </Label>
                  <Input
                    placeholder="Ex: Reserva de emergência"
                    {...createForm.register("nome")}
                    className={cn(
                      "h-11 rounded-xl border-border/40 bg-background placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all",
                      createForm.formState.errors.nome && "border-red-500"
                    )}
                  />
                  {createForm.formState.errors.nome && (
                    <p className="text-xs text-red-500 font-medium">
                      {createForm.formState.errors.nome.message}
                    </p>
                  )}
                </div>

                <div className="border-t border-border/20" />

                {/* Type selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Tipo
                  </Label>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    {(["juntar_valor", "reduzir_gasto", "reserva_mensal"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => createForm.setValue("tipo", t)}
                        className={cn(
                          "group relative flex flex-col items-center gap-1.5 sm:gap-2.5 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-semibold transition-all duration-200 cursor-pointer border",
                          tipo === t
                            ? "bg-emerald-600/5 text-emerald-600 border-emerald-600/20 shadow-sm shadow-emerald-500/5"
                            : "bg-muted/20 text-muted-foreground border-border/30 hover:bg-muted/40 hover:border-border/50 hover:text-foreground"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-lg sm:rounded-xl transition-all",
                            tipo === t ? "bg-emerald-600/10" : "bg-muted/40 group-hover:bg-muted/60"
                          )}
                        >
                          {tiposIcon[t]}
                        </div>
                        {tiposLabel[t]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border/20" />

                {/* Priority */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Prioridade
                  </Label>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    {(["baixa", "media", "alta"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => createForm.setValue("prioridade", p)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 py-2.5 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-semibold transition-all duration-200 cursor-pointer border",
                          prioridade === p
                            ? `${prioridadeConfig[p].badge} border-2 shadow-sm`
                            : "bg-muted/20 text-muted-foreground border-border/30 hover:bg-muted/40 hover:border-border/50 hover:text-foreground"
                        )}
                      >
                        <Flag
                          className={cn("h-3 w-3", prioridade === p && prioridadeConfig[p].color)}
                        />
                        {p === "baixa" ? "Baixa" : p === "media" ? "Média" : "Alta"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Values section */}
              <div className="space-y-4 rounded-2xl border border-emerald-600/[0.08] dark:border-slate-700/40 bg-white dark:bg-slate-800/60 shadow-[0_1px_6px_rgba(16,185,129,0.06)] dark:shadow-none p-4 sm:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Valor Alvo (R$)
                    </Label>
                    <div className="relative">
                      <div className="absolute left-0 top-0 bottom-0 w-9 sm:w-10 flex items-center justify-center rounded-l-xl text-xs font-bold bg-emerald-600/10 text-emerald-600">
                        R$
                      </div>
                      <CurrencyInput
                        placeholder="0,00"
                        className={cn(
                          "h-11 rounded-xl pl-10 sm:pl-11 tabular-nums font-bold border-border/40 bg-background placeholder:text-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all",
                          createForm.formState.errors.valorAlvo && "border-red-500"
                        )}
                        value={createForm.watch("valorAlvo")}
                        onValueChange={(v) =>
                          createForm.setValue("valorAlvo", v, {
                            shouldValidate: createForm.formState.isSubmitted,
                          })
                        }
                      />
                    </div>
                    {createForm.formState.errors.valorAlvo && (
                      <p className="text-xs text-red-500 font-medium">
                        {createForm.formState.errors.valorAlvo.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Já guardado (R$)
                    </Label>
                    <div className="relative">
                      <div className="absolute left-0 top-0 bottom-0 w-9 sm:w-10 flex items-center justify-center rounded-l-xl text-xs font-bold bg-emerald-500/10 text-emerald-500">
                        R$
                      </div>
                      <CurrencyInput
                        placeholder="0,00"
                        className="h-11 rounded-xl pl-10 sm:pl-11 tabular-nums font-bold border-border/40 bg-background placeholder:text-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all"
                        value={createForm.watch("valorAtual") ?? ""}
                        onValueChange={(v) =>
                          createForm.setValue("valorAtual", v, {
                            shouldValidate: createForm.formState.isSubmitted,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/20" />

                {/* Deadline */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Prazo
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                    <Input
                      type="date"
                      {...createForm.register("prazo")}
                      className={cn(
                        "h-11 rounded-xl pl-10 border-border/40 bg-background focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all",
                        createForm.formState.errors.prazo && "border-red-500"
                      )}
                    />
                    {createForm.formState.errors.prazo && (
                      <p className="text-xs text-red-500 font-medium">
                        {createForm.formState.errors.prazo.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Category (for "reduzir_gasto") */}
                <AnimatePresence>
                  {tipo === "reduzir_gasto" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1.5 overflow-hidden"
                    >
                      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Categoria
                      </Label>
                      <Select
                        value={createForm.watch("categoria") || ""}
                        onValueChange={(v) => createForm.setValue("categoria", v)}
                      >
                        <SelectTrigger className="h-11 rounded-xl border-border/40 bg-background focus:ring-1 focus:ring-primary/30">
                          <SelectValue placeholder="Selecione a categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categorias.map((c) => (
                            <SelectItem key={c.id} value={c.nome}>
                              {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-xl gap-2 font-semibold text-sm bg-emerald-600 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 text-white transition-all duration-300 cursor-pointer active:scale-[0.98]"
                loading={criarMeta.isPending}
              >
                <Target className="h-5 w-5" />
                Criar Meta
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Edit Value Dialog ═══ */}
      <Dialog
        open={editMeta !== null}
        onOpenChange={(open) => {
          if (!open) setEditMeta(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-emerald-600/8 bg-emerald-600/3 p-3.5 sm:p-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-emerald-600/15 text-emerald-600 shadow-sm shadow-emerald-500/10">
                <Edit3 className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-semibold">
                  Atualizar valor
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs sm:text-[13px] mt-0.5 truncate">
                  Informe o novo valor atual da meta &quot;{editMeta?.nome}&quot;
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {editMeta && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/30">
              <div className="relative h-12 w-12 shrink-0">
                <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
                  <circle cx="24" cy="24" r="18" fill="none" strokeWidth="4" strokeLinecap="round" className={progressStrokeColor(editMeta.percentualConcluido)} stroke="currentColor" strokeDasharray={`${Math.min(editMeta.percentualConcluido, 100) * 1.131} 113.1`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-extrabold tabular-nums">{editMeta.percentualConcluido.toFixed(0)}%</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{editMeta.nome}</p>
                <p className="text-[11px] text-muted-foreground/60 tabular-nums font-medium">
                  Alvo: {formatCurrency(editMeta.valorAlvo)}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={editForm.handleSubmit(handleAtualizar)} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Valor Atual (R$)
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  {...editForm.register("valorAtual")}
                  className={cn(
                    "h-11 rounded-xl pl-9 tabular-nums font-semibold",
                    editForm.formState.errors.valorAtual && "border-red-500"
                  )}
                />
              </div>
              {editForm.formState.errors.valorAtual && (
                <p className="text-xs text-red-500 font-medium">
                  {editForm.formState.errors.valorAtual.message}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditMeta(null)}
                className="h-12 rounded-xl flex-1 font-semibold dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={actionLoading === editMeta?.id}
                className="h-12 rounded-xl flex-1 gap-2 font-semibold text-sm bg-emerald-600 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle2 className="h-5 w-5" />
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ Delete Dialog ═══ */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader className="items-start text-left">
            <AlertDialogTitle className="sr-only">Remover meta?</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              Tem certeza que deseja remover esta meta? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
            <DialogShellHeader
              icon={<Trash2 className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Remover meta?"
              description="Tem certeza que deseja remover esta meta? Essa ação não pode ser desfeita."
              tone="rose"
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemover}
              loading={actionLoading === deleteId}
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
  const pct = Math.min(meta.percentualConcluido, 100);
  const status = statusConfig[meta.status] ?? statusConfig.ativa;
  const isPaused = meta.status === "pausada";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "glass-panel rounded-2xl group hover:-translate-y-0.5 transition-all duration-300 flex flex-col",
        isPaused && "opacity-75"
      )}
    >
      {/* Header */}
      <div className="p-5 pb-0">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "size-11 rounded-full flex items-center justify-center shadow-sm",
                meta.tipo === "juntar_valor" &&
                "bg-sky-100 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400",
                meta.tipo === "reduzir_gasto" &&
                "bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400",
                meta.tipo === "reserva_mensal" &&
                "bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400"
              )}
            >
              {tiposIcon[meta.tipo] ?? <Target className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <h4 className="font-bold tracking-tight text-sm text-slate-800 dark:text-white truncate">
                {meta.nome}
              </h4>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                {tiposLabel[meta.tipo] || meta.tipo}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide",
                status.badgeClass
              )}
            >
              {status.label}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer sm:opacity-0 sm:group-hover:opacity-100">
                  <MoreVertical className="h-4 w-4 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit} className="gap-2 cursor-pointer">
                  <Edit3 className="h-3.5 w-3.5" /> Atualizar valor
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onPausar}
                  disabled={actionLoading === meta.id}
                  className="gap-2 cursor-pointer"
                >
                  {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                  {isPaused ? "Retomar" : "Pausar"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onRemover}
                  className="gap-2 text-red-600 dark:text-red-400 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remover
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Progress visual */}
      <div className="px-5 pb-4 pt-2">
        <div className="flex items-center gap-5 mb-3">
          <div className="relative size-20 shrink-0">
            <svg className="size-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-100 dark:text-slate-700/50"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className={progressColor(pct)}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeDasharray={`${pct}, 100`}
                strokeLinecap="round"
                strokeWidth="3"
                style={{ transition: "stroke-dasharray 0.8s ease-out" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-base font-extrabold text-slate-800 dark:text-white tabular-nums">
                {meta.percentualConcluido.toFixed(0)}%
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex justify-between items-end">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Atual</span>
              <span className={cn("text-sm font-bold tabular-nums", progressColor(pct))}>
                {formatCurrency(meta.valorAtual)}
              </span>
            </div>
            <div className="w-full h-px bg-slate-200 dark:bg-slate-700/40" />
            <div className="flex justify-between items-start">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Objetivo
              </span>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                {formatCurrency(meta.valorAlvo)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="px-5 py-3 mt-auto border-t border-slate-200/60 dark:border-slate-700/30 bg-slate-50/50 dark:bg-slate-800/20 rounded-b-2xl">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 dark:text-slate-400">Prazo</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
              {formatShortDate(meta.prazo)}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 dark:text-slate-400">Economia mensal nec.</span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                isPaused
                  ? "text-slate-400 dark:text-slate-500"
                  : meta.valorMensalNecessario > meta.valorAtual * 0.3
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {isPaused ? "Pausado" : formatCurrency(meta.valorMensalNecessario)}
            </span>
          </div>
          {meta.desvio && !isPaused && (
            <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 font-medium pt-0.5">
              {desvioIcon(meta.desvio)}
              <span>{meta.desvio === "no_ritmo" ? "no ritmo" : meta.desvio}</span>
              <span className="mx-1">·</span>
              <span className="tabular-nums">
                {meta.mesesRestantes} {meta.mesesRestantes === 1 ? "mês" : "meses"}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
