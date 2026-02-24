"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  useLembretes,
  useCriarLembrete,
  useAtualizarLembrete,
  useDesativarLembrete,
  useCategorias,
  usePagarContaFixa,
  useContasBancarias,
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
  RefreshCw,
  Calendar,
  FileText,
  AlertTriangle,
  Clock,
  MoreVertical,
  Home,
  Wifi,
  Dumbbell,
  Tv2,
  GraduationCap,
  Car,
  Heart,
  ShoppingBag,
  Utensils,
  Zap,
  Building2,
  ChevronLeft,
  ChevronRight,
  Banknote,
} from "lucide-react";
import {
  EmptyState,
  ErrorState,
  CardSkeleton,
} from "@/components/shared/page-components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LembretePagamento } from "@/lib/api";

// ── Category icon helper ─────────────────────────────────
function getCategoryIcon(categoria: string) {
  const n = (categoria ?? "").toLowerCase();
  if (n.includes("moradia") || n.includes("aluguel") || n.includes("casa")) return { icon: Home, color: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
  if (n.includes("utilidade") || n.includes("internet") || n.includes("água") || n.includes("energia") || n.includes("luz") || n.includes("gas") || n.includes("gás")) return { icon: Wifi, color: "bg-teal-100 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400" };
  if (n.includes("saúde") || n.includes("médico") || n.includes("plano") || n.includes("hospital")) return { icon: Heart, color: "bg-pink-100 dark:bg-pink-500/15 text-pink-600 dark:text-pink-400" };
  if (n.includes("academia") || n.includes("gym") || n.includes("fitness")) return { icon: Dumbbell, color: "bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400" };
  if (n.includes("entretenimento") || n.includes("assinatura") || n.includes("streaming") || n.includes("netflix") || n.includes("spotify")) return { icon: Tv2, color: "bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400" };
  if (n.includes("educação") || n.includes("curso") || n.includes("escola") || n.includes("faculdade")) return { icon: GraduationCap, color: "bg-cyan-100 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400" };
  if (n.includes("transporte") || n.includes("carro") || n.includes("combustível") || n.includes("uber")) return { icon: Car, color: "bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400" };
  if (n.includes("alimentação") || n.includes("mercado") || n.includes("comida")) return { icon: Utensils, color: "bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400" };
  if (n.includes("compras") || n.includes("shopping")) return { icon: ShoppingBag, color: "bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400" };
  if (n.includes("energia") || n.includes("elétrica")) return { icon: Zap, color: "bg-yellow-100 dark:bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" };
  if (n.includes("empresa") || n.includes("escritório") || n.includes("negócio")) return { icon: Building2, color: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
  return { icon: FileText, color: "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400" };
}

// ── Helpers ────────────────────────────────────────────────
const isVencido = (dataVenc: string) => new Date(dataVenc) < new Date(new Date().toISOString().split("T")[0]);

const isProximo = (dataVenc: string) => {
  const diff = new Date(dataVenc).getTime() - new Date(new Date().toISOString().split("T")[0]).getTime();
  return diff >= 0 && diff <= 3 * 24 * 60 * 60 * 1000;
};

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
  if (isVencido(dataVenc))
    return {
      label: "Vencido",
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-100 dark:bg-red-500/15",
      icon: AlertCircle,
      badgeClass: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
    };
  if (isProximo(dataVenc))
    return {
      label: "Próximo",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-500/15",
      icon: AlertTriangle,
      badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
    };
  return {
    label: "Em dia",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-500/15",
    icon: CheckCircle2,
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  };
}

export default function ContasFixasPage() {
  const { data: lembretes = [], isLoading, isError, error, refetch } = useLembretes(false);
  const { data: categorias = [] } = useCategorias();
  const { data: contasBancarias = [] } = useContasBancarias();
  const criarLembrete = useCriarLembrete();
  const atualizarLembrete = useAtualizarLembrete();
  const desativarLembrete = useDesativarLembrete();
  const pagarConta = usePagarContaFixa();

  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<LembretePagamento | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [pagarItem, setPagarItem] = useState<LembretePagamento | null>(null);
  const [pagarValor, setPagarValor] = useState("");
  const [pagarContaBancariaId, setPagarContaBancariaId] = useState("");
  const [pagarData, setPagarData] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

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
    const matchedCat = categorias.find((c) => c.id === lembrete.categoriaId);
    editForm.reset({
      descricao: lembrete.descricao,
      valor: lembrete.valor != null ? lembrete.valor.toFixed(2).replace(".", ",") : "",
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
        frequencia: isRecorrente ? (data.frequencia as FrequenciaLembrete) : undefined,
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
          frequencia: isRecorrente ? (data.frequencia as FrequenciaLembrete) : undefined,
          diaSemanaRecorrente: (data.frequencia === "Semanal" || data.frequencia === "Quinzenal") && data.diaSemana ? parseInt(data.diaSemana) : undefined,
          categoria: data.categoria.trim(),
          formaPagamento: data.formaPagamento,
          lembreteTelegramAtivo: data.lembreteTelegramAtivo,
          dataFimRecorrencia: isRecorrente && data.dataFimRecorrencia ? data.dataFimRecorrencia : isRecorrente ? undefined : "",
        },
      },
      { onSuccess: resetForm }
    );
  };

  const handleDesativar = () => {
    if (!deleteId) return;
    desativarLembrete.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
  };

  const openPagar = (l: LembretePagamento) => {
    const hoje = new Date().toISOString().split("T")[0];
    setPagarItem(l);
    setPagarValor(l.valor != null ? l.valor.toFixed(2).replace(".", ",") : "");
    setPagarContaBancariaId("");
    setPagarData(hoje);
  };

  async function handlePagar(e: React.FormEvent) {
    e.preventDefault();
    if (!pagarItem) return;
    const valorPago = parseFloat(pagarValor.replace(",", ".")) || undefined;
    const contaBancariaId = pagarContaBancariaId ? parseInt(pagarContaBancariaId) : undefined;
    await pagarConta.mutateAsync({
      id: pagarItem.id,
      data: { valorPago, contaBancariaId, dataPagamento: pagarData || undefined },
    });
    setPagarItem(null);
  }

  // ── Filtered list ──
  const filtered = useMemo(() => {
    return lembretes.filter((l) => {
      if (busca.trim() && !l.descricao.toLowerCase().includes(busca.toLowerCase())) return false;
      if (filtroStatus === "ativas" && l.ativo === false) return false;
      if (filtroStatus === "inativas" && l.ativo !== false) return false;
      return true;
    });
  }, [lembretes, busca, filtroStatus]);

  const stats = useMemo(() => {
    const ativos = lembretes.filter((l) => l.ativo !== false);
    const vencidos = ativos.filter((l) => isVencido(l.dataVencimento)).length;
    const proximos = ativos.filter((l) => isProximo(l.dataVencimento)).length;
    const total = ativos.reduce((sum, l) => sum + (l.valor ?? 0), 0);
    const proximaVencer = ativos
      .filter((l) => !isVencido(l.dataVencimento))
      .sort((a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime())[0] ?? null;
    return { vencidos, proximos, total, count: ativos.length, proximaVencer };
  }, [lembretes]);

  const activeFilters = (filtroStatus !== "todos" ? 1 : 0) + (busca.trim() ? 1 : 0);

  const paged = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page, PAGE_SIZE]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* ═══ Action Bar ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/50 dark:border-slate-700/30 rounded-2xl p-4 lg:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="size-10 flex items-center justify-center bg-emerald-600/10 rounded-xl">
            <CalendarClock className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
              Contas Fixas
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Lembretes de pagamento e contas recorrentes
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
            onClick={() => { createForm.reset(); setShowForm(true); }}
            className="bg-emerald-600 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-2 cursor-pointer text-sm"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Conta Fixa</span>
            <span className="sm:hidden">Nova</span>
          </button>
        </div>
      </motion.div>

      {/* ═══ Stat Cards ═══ */}
      {isLoading ? (
        <CardSkeleton count={4} />
      ) : isError ? (
        <ErrorState message={error?.message} onRetry={() => refetch()} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
          {/* Total de Contas */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }} className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300">
            <div className="absolute -right-6 -bottom-6 bg-emerald-500/10 w-28 h-28 rounded-full blur-2xl group-hover:bg-emerald-500/15 transition-all" />
            <div className="flex justify-between items-start z-10">
              <div className="size-10 flex items-center justify-center bg-emerald-100 dark:bg-emerald-500/15 rounded-xl text-emerald-600 dark:text-emerald-400">
                <FileText className="h-5 w-5" />
              </div>
            </div>
            <div className="z-10 mt-auto">
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Contas Ativas</p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">{stats.count}</h3>
            </div>
          </motion.div>

          {/* Valor Mensal Total */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300">
            <div className="absolute -right-6 -bottom-6 bg-emerald-500/10 w-28 h-28 rounded-full blur-2xl group-hover:bg-emerald-500/15 transition-all" />
            <div className="flex justify-between items-start z-10">
              <div className="size-10 flex items-center justify-center bg-emerald-100 dark:bg-emerald-500/15 rounded-xl text-emerald-600 dark:text-emerald-400">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <div className="z-10 mt-auto">
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Valor Mensal Total</p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">{formatCurrency(stats.total)}</h3>
            </div>
          </motion.div>

          {/* Próxima a Vencer */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-5 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300">
            <div className="absolute -right-6 -bottom-6 bg-amber-500/10 w-28 h-28 rounded-full blur-2xl group-hover:bg-amber-500/15 transition-all" />
            <div className="flex justify-between items-start z-10">
              <div className="size-10 flex items-center justify-center bg-amber-100 dark:bg-amber-500/15 rounded-xl text-amber-600 dark:text-amber-400">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <div className="z-10 mt-auto">
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Próxima a Vencer</p>
              {stats.proximaVencer ? (
                <>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white leading-tight truncate">{stats.proximaVencer.descricao}</h3>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                    {(() => {
                      const diff = Math.ceil((new Date(stats.proximaVencer.dataVencimento).getTime() - new Date(new Date().toISOString().split("T")[0]).getTime()) / 86400000);
                      const d = new Date(stats.proximaVencer.dataVencimento);
                      const fmt = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
                      return diff === 0 ? `Vence hoje (${fmt})` : diff === 1 ? `Vence amanhã (${fmt})` : `Vence em ${diff} dias (${fmt})`;
                    })()}
                  </p>
                </>
              ) : (
                <h3 className="text-sm font-medium text-slate-400 dark:text-slate-500">Nenhuma</h3>
              )}
            </div>
          </motion.div>

          {/* Contas Vencidas */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={cn("glass-panel p-5 rounded-2xl flex flex-col justify-between h-32 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300", stats.vencidos > 0 && "ring-2 ring-red-500/20")}>
            <div className="absolute -right-6 -bottom-6 bg-red-500/10 w-28 h-28 rounded-full blur-2xl group-hover:bg-red-500/15 transition-all" />
            <div className="flex justify-between items-start z-10">
              <div className="size-10 flex items-center justify-center bg-red-100 dark:bg-red-500/15 rounded-xl text-red-600 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
              </div>
              {stats.vencidos > 0 && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-full text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
                  Atenção
                </span>
              )}
            </div>
            <div className="z-10 mt-auto">
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Contas Vencidas</p>
              <h3 className={cn("text-2xl font-bold tracking-tight", stats.vencidos > 0 ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-white")}>{stats.vencidos}</h3>
            </div>
          </motion.div>
        </div>
      )}

      {/* ═══ Filter Bar ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-panel rounded-2xl p-4 lg:p-5"
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 w-full lg:max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              placeholder="Buscar lembretes..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full h-10 pl-10 pr-9 rounded-xl bg-white/70 dark:bg-slate-700/50 border border-white/60 dark:border-slate-600/60 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600/30 transition-all"
            />
            {busca && (
              <button onClick={() => setBusca("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer" aria-label="Limpar busca">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="hidden lg:block h-8 w-px bg-slate-200 dark:bg-slate-700" />

          {/* Status filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { key: "todos", label: "Todas" },
              { key: "ativas", label: "Ativas" },
              { key: "inativas", label: "Inativas" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => { setFiltroStatus(f.key); setPage(0); }}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer",
                  filtroStatus === f.key
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                    : "bg-white/60 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 border border-white/60 dark:border-slate-600/50"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {activeFilters > 0 && (
            <button
              onClick={() => { setFiltroStatus("todos"); setBusca(""); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              Limpar Filtros
            </button>
          )}
        </div>
      </motion.div>

      {/* ═══ Bills Table ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="glass-panel rounded-2xl overflow-hidden"
      >
        {/* Table header */}
        <div className="overflow-x-auto">
        <div className="hidden lg:grid gap-4 items-center px-6 py-3.5 border-b border-slate-200/60 dark:border-slate-700/40 bg-slate-50/50 dark:bg-slate-800/30 min-w-225" style={{gridTemplateColumns:"2fr 1fr 1fr 1fr 1.2fr 120px 80px 100px"}}>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Descrição</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Valor Mensal</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Frequência</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Dia Venc.</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Próx. Vencimento</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Status</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Ativa</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Ações</span>
        </div>

        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Carregando lembretes...</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
            <AnimatePresence>
              {paged.map((l, i) => {
                const status = getStatusInfo(l.dataVencimento);
                const catInfo = getCategoryIcon(l.categoria ?? "");
                const CatIcon = catInfo.icon;
                const freqLabel = l.frequencia === "Semanal" ? "Semanal"
                  : l.frequencia === "Quinzenal" ? "Quinzenal"
                  : l.frequencia === "Anual" ? "Anual"
                  : (l.recorrenteMensal || l.frequencia === "Mensal") ? "Mensal"
                  : "Único";
                const diaLabel = l.diaRecorrente ? `Dia ${l.diaRecorrente}` : "—";
                return (
                  <motion.div
                    key={l.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: 0.015 * i }}
                    className="group"
                  >
                    {/* Desktop row */}
                    <div className={cn("hidden lg:grid gap-4 items-center px-6 py-3.5 hover:bg-white/40 dark:hover:bg-slate-800/30 transition-all duration-200 min-w-225", !l.ativo && "opacity-60")} style={{gridTemplateColumns:"2fr 1fr 1fr 1fr 1.2fr 120px 80px 100px"}}>
                      {/* Description */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105",
                          catInfo.color
                        )}>
                          <CatIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-slate-800 dark:text-white truncate">{l.descricao}</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate">{l.categoria ?? "—"}</p>
                        </div>
                      </div>

                      {/* Value */}
                      <span className="text-[13px] font-bold text-slate-800 dark:text-white tabular-nums">
                        {l.valor != null ? formatCurrency(l.valor) : "—"}
                      </span>

                      {/* Frequency */}
                      <span className="text-[13px] text-slate-500 dark:text-slate-400 font-medium">{freqLabel}</span>

                      {/* Due day */}
                      <span className="text-[13px] text-slate-500 dark:text-slate-400 font-medium tabular-nums">{diaLabel}</span>

                      {/* Next due date */}
                      <span className={cn(
                        "text-[13px] font-medium tabular-nums",
                        l.ativo === false ? "text-slate-400 dark:text-slate-600" :
                        isVencido(l.dataVencimento) ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-300"
                      )}>
                        {l.ativo === false ? "—" : formatShortDate(l.dataVencimento)}
                      </span>

                      {/* Status badge */}
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold w-fit",
                        l.pagoCicloAtual
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                          : !l.ativo
                            ? "bg-slate-100 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400"
                            : status.badgeClass
                      )}>
                        {l.pagoCicloAtual ? (
                          <><CheckCircle2 className="h-3 w-3" /> Pago</>
                        ) : !l.ativo ? "Inativa" : status.label}
                      </span>

                      {/* Active toggle */}
                      <div>
                        <Switch
                          checked={l.ativo !== false}
                          onCheckedChange={(checked) => {
                            if (!checked) setDeleteId(l.id);
                            else atualizarLembrete.mutate({ id: l.id, data: { ativo: true } });
                          }}
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        {l.ativo !== false && !l.pagoCicloAtual && (
                          <button
                            onClick={() => openPagar(l)}
                            className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                            title="Registrar pagamento"
                          >
                            <Banknote className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button onClick={() => openEdit(l)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleteId(l.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors cursor-pointer">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div className={cn("lg:hidden flex items-center gap-3 px-4 py-3.5 hover:bg-white/30 dark:hover:bg-slate-800/20 transition-colors", !l.ativo && "opacity-60")}>
                      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm", catInfo.color)}>
                        <CatIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-slate-800 dark:text-white truncate">{l.descricao}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{l.categoria ?? "—"}</span>
                          {l.valor != null && (
                            <>
                              <span className="text-[11px] text-slate-300 dark:text-slate-600">·</span>
                              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 tabular-nums">{formatCurrency(l.valor)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn("inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold",
                          l.pagoCicloAtual
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                            : !l.ativo ? "bg-slate-100 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400" : status.badgeClass)}>
                          {l.pagoCicloAtual ? "Pago" : !l.ativo ? "Inativa" : status.label}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                              <MoreVertical className="h-4 w-4 text-slate-400" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {l.ativo !== false && !l.pagoCicloAtual && (
                              <DropdownMenuItem onClick={() => openPagar(l)} className="gap-2 text-emerald-600 dark:text-emerald-400 cursor-pointer">
                                <Banknote className="h-3.5 w-3.5" /> Pagar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => openEdit(l)} className="gap-2 cursor-pointer">
                              <Pencil className="h-3.5 w-3.5" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteId(l.id)} className="gap-2 text-red-600 dark:text-red-400 cursor-pointer">
                              <Trash2 className="h-3.5 w-3.5" /> Desativar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
                  <Button variant="outline" onClick={() => { setFiltroStatus("todos"); setBusca(""); }} className="gap-2 rounded-xl">
                    <X className="h-4 w-4" />
                    Limpar filtros
                  </Button>
                ) : (
                  <button onClick={() => setShowForm(true)} className="bg-emerald-600 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer text-sm">
                    <Plus className="h-4 w-4" />
                    Criar primeiro lembrete
                  </button>
                )
              }
            />
          </div>
        )}
        </div>{/* end overflow-x-auto */}

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800/50">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Mostrando <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(page * PAGE_SIZE + 1, filtered.length)}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)}</span> de <span className="font-semibold text-slate-700 dark:text-slate-300">{filtered.length}</span> contas
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Próxima <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* ═══ New Bill Sheet ═══ */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="w-full sm:w-125 sm:max-w-125 overflow-hidden">
          <div className="h-1.5 w-full shrink-0 bg-linear-to-r from-emerald-600 via-emerald-400 to-teal-500 shadow-[0_2px_8px_rgba(16,185,129,0.3)]" />

          <SheetHeader className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 sm:pb-5">
            <div className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-emerald-600/8 bg-emerald-600/3 p-3.5 sm:p-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-emerald-600/15 text-emerald-600 shadow-sm shadow-emerald-500/10 transition-all duration-500">
                <CalendarClock className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-lg sm:text-xl font-semibold">Nova Conta Fixa</SheetTitle>
                <SheetDescription className="text-muted-foreground text-xs sm:text-[13px] mt-0.5 truncate">Configure sua conta fixa ou pagamento recorrente</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            <form onSubmit={createForm.handleSubmit(handleCriar)} className="px-5 sm:px-7 pb-8 space-y-4 sm:space-y-5">
              {/* Main fields */}
              <div className="space-y-4 rounded-2xl border border-emerald-600/8 dark:border-slate-700/40 bg-white dark:bg-slate-800/60 shadow-[0_1px_6px_rgba(16,185,129,0.06)] dark:shadow-none p-4 sm:p-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Descrição</Label>
                  <Input placeholder="Ex: Aluguel, Internet, Energia..." {...createForm.register("descricao")} className={cn("h-11 rounded-xl border-border/40 bg-background placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all", createForm.formState.errors.descricao && "border-red-500")} />
                  {createForm.formState.errors.descricao && <p className="text-xs text-red-500 font-medium">{createForm.formState.errors.descricao.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor (R$)</Label>
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-11 sm:w-12 flex items-center justify-center rounded-l-xl text-sm font-bold bg-emerald-600/10 text-emerald-600">R$</div>
                    <CurrencyInput
                      placeholder="0,00"
                      className={cn("h-12 sm:h-14 rounded-xl pl-12 sm:pl-14 text-xl sm:text-2xl tabular-nums font-bold border-border/40 bg-background placeholder:text-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all", createForm.formState.errors.valor && "border-red-500")}
                      value={createForm.watch("valor")}
                      onValueChange={(v) => createForm.setValue("valor", v, { shouldValidate: createForm.formState.isSubmitted })}
                    />
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
                        "h-10 px-3 rounded-xl border text-sm font-medium cursor-pointer transition-all",
                        createForm.watch("lembreteTelegramAtivo")
                          ? "border-emerald-600 bg-emerald-600/10 text-emerald-600"
                          : "border-border/40 text-muted-foreground"
                      )}
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => createForm.setValue("lembreteTelegramAtivo", false)}
                      className={cn(
                        "h-10 px-3 rounded-xl border text-sm font-medium cursor-pointer transition-all",
                        !createForm.watch("lembreteTelegramAtivo")
                          ? "border-emerald-600 bg-emerald-600/10 text-emerald-600"
                          : "border-border/40 text-muted-foreground"
                      )}
                    >
                      Não
                    </button>
                  </div>
                </div>
              </div>

              {/* Frequency selector */}
              <div className="space-y-4 rounded-2xl border border-emerald-600/8 dark:border-slate-700/40 bg-white dark:bg-slate-800/60 shadow-[0_1px_6px_rgba(16,185,129,0.06)] dark:shadow-none p-4 sm:p-5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Frequência</Label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
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
                          ? "border-emerald-600 bg-emerald-600/10 text-emerald-600 shadow-sm shadow-emerald-500/10"
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
                                  ? "border-emerald-600 bg-emerald-600/15 text-emerald-600"
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
                <div className="space-y-4 rounded-2xl border border-emerald-600/8 dark:border-slate-700/40 bg-white dark:bg-slate-800/60 shadow-[0_1px_6px_rgba(16,185,129,0.06)] dark:shadow-none p-4 sm:p-5">
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
                  className="w-full h-12 sm:h-13 rounded-xl sm:rounded-2xl gap-2 sm:gap-2.5 font-semibold text-sm sm:text-[15px] bg-emerald-600 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 text-white transition-all duration-300 cursor-pointer active:scale-[0.98]"
                  loading={criarLembrete.isPending}
                >
                  <CheckCircle2 className="h-5 w-5" />
                  Criar Conta Fixa
                </Button>
              </div>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══ Edit Dialog ═══ */}
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
                <CurrencyInput
                  placeholder="0,00"
                  className={cn("h-11 rounded-xl pl-9 tabular-nums", editForm.formState.errors.valor && "border-red-500")}
                  value={editForm.watch("valor") ?? ""}
                  onValueChange={(v) => editForm.setValue("valor", v, { shouldValidate: editForm.formState.isSubmitted })}
                />
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
                    "h-10 px-3 rounded-xl border text-sm font-medium cursor-pointer transition-all",
                    editForm.watch("lembreteTelegramAtivo")
                      ? "border-emerald-600 bg-emerald-600/10 text-emerald-600"
                      : "border-border/40 text-muted-foreground"
                  )}
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => editForm.setValue("lembreteTelegramAtivo", false)}
                  className={cn(
                    "h-10 px-3 rounded-xl border text-sm font-medium cursor-pointer transition-all",
                    !editForm.watch("lembreteTelegramAtivo")
                      ? "border-emerald-600 bg-emerald-600/10 text-emerald-600"
                      : "border-border/40 text-muted-foreground"
                  )}
                >
                  Não
                </button>
              </div>
            </div>

            {/* Frequency selector */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Frequência</Label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
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
                        ? "border-emerald-600 bg-emerald-600/10 text-emerald-600"
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
                            ? "border-emerald-600 bg-emerald-600/15 text-emerald-600"
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

            <Button type="submit" className="w-full h-11 rounded-xl gap-2 font-bold bg-emerald-600 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" loading={atualizarLembrete.isPending}>
              Salvar alterações
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ Delete Dialog ═══ */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="dark:bg-slate-900 dark:border-slate-700/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-white">Desativar lembrete?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 dark:text-slate-400">Tem certeza que deseja desativar este lembrete? Ele não aparecerá mais na lista.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDesativar} loading={desativarLembrete.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl gap-2">
              <Trash2 className="h-4 w-4" />
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ Payment Dialog ═══ */}
      <Dialog open={pagarItem !== null} onOpenChange={(open) => { if (!open) setPagarItem(null); }}>
        <DialogContent className="sm:max-w-sm dark:bg-slate-900 dark:border-slate-700/50">
          <div className="h-1 w-full -mt-6 -mx-6 mb-5 rounded-t-lg bg-linear-to-r from-emerald-500 via-green-500 to-teal-500 shadow-[0_2px_8px_rgba(16,185,129,0.3)]" />
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white flex items-center gap-2">
              <div className="size-8 flex items-center justify-center bg-emerald-100 dark:bg-emerald-500/15 rounded-lg">
                <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Registrar Pagamento
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              {pagarItem?.descricao}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePagar} className="space-y-4 mt-2">
            {/* Valor */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor Pago (R$)</Label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center rounded-l-xl text-sm font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  R$
                </div>
                <CurrencyInput
                  placeholder="0,00"
                  value={pagarValor}
                  onValueChange={(v) => setPagarValor(v)}
                  className="h-11 rounded-xl pl-11 text-lg tabular-nums font-bold border-border/40 bg-background focus-visible:ring-1 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/40 transition-all dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
            </div>

            {/* Data */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Data do Pagamento</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                <Input
                  type="date"
                  value={pagarData}
                  onChange={(e) => setPagarData(e.target.value)}
                  className="h-11 rounded-xl pl-9 border-border/40 bg-background dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
            </div>

            {/* Conta Bancária */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Conta Bancária <span className="text-muted-foreground/40 normal-case">(opcional)</span>
              </Label>
              <Select value={pagarContaBancariaId} onValueChange={setPagarContaBancariaId}>
                <SelectTrigger className="h-11 rounded-xl border-border/40 bg-background dark:bg-slate-800 dark:border-slate-700">
                  <SelectValue placeholder="Selecionar conta..." />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-900 dark:border-slate-700">
                  {contasBancarias.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)} className="dark:focus:bg-slate-800">
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setPagarItem(null)} className="rounded-xl flex-1 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={pagarConta.isPending}
                className="rounded-xl flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirmar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
