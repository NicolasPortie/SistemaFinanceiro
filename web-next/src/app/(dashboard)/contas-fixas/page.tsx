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
  useCartoes,
} from "@/hooks/use-queries";
import { formatCurrency } from "@/lib/format";
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
  Calendar,
  FileText,
  AlertTriangle,
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
  Power,
  PowerOff,
} from "lucide-react";
import { EmptyState, ErrorState, CardSkeleton } from "@/components/shared/page-components";
import { DialogShellHeader } from "@/components/shared/dialog-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import type { LembretePagamento } from "@/lib/api";
import { toast } from "sonner";

// ── Category icon helper ─────────────────────────────────
function getCategoryIcon(categoria: string) {
  const n = (categoria ?? "").toLowerCase();
  if (n.includes("moradia") || n.includes("aluguel") || n.includes("casa"))
    return {
      icon: Home,
      color: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    };
  if (
    n.includes("utilidade") ||
    n.includes("internet") ||
    n.includes("água") ||
    n.includes("energia") ||
    n.includes("luz") ||
    n.includes("gas") ||
    n.includes("gás")
  )
    return {
      icon: Wifi,
      color: "bg-teal-100 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400",
    };
  if (n.includes("saúde") || n.includes("médico") || n.includes("plano") || n.includes("hospital"))
    return {
      icon: Heart,
      color: "bg-pink-100 dark:bg-pink-500/15 text-pink-600 dark:text-pink-400",
    };
  if (n.includes("academia") || n.includes("gym") || n.includes("fitness"))
    return {
      icon: Dumbbell,
      color: "bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400",
    };
  if (
    n.includes("entretenimento") ||
    n.includes("assinatura") ||
    n.includes("streaming") ||
    n.includes("netflix") ||
    n.includes("spotify")
  )
    return {
      icon: Tv2,
      color: "bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400",
    };
  if (
    n.includes("educação") ||
    n.includes("curso") ||
    n.includes("escola") ||
    n.includes("faculdade")
  )
    return {
      icon: GraduationCap,
      color: "bg-cyan-100 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
    };
  if (
    n.includes("transporte") ||
    n.includes("carro") ||
    n.includes("combustível") ||
    n.includes("uber")
  )
    return {
      icon: Car,
      color: "bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400",
    };
  if (n.includes("alimentação") || n.includes("mercado") || n.includes("comida"))
    return {
      icon: Utensils,
      color: "bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400",
    };
  if (n.includes("compras") || n.includes("shopping"))
    return {
      icon: ShoppingBag,
      color: "bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400",
    };
  if (n.includes("energia") || n.includes("elétrica"))
    return {
      icon: Zap,
      color: "bg-yellow-100 dark:bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
    };
  if (n.includes("empresa") || n.includes("escritório") || n.includes("negócio"))
    return {
      icon: Building2,
      color: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    };
  return {
    icon: FileText,
    color: "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400",
  };
}

// ── Helpers ────────────────────────────────────────────────
const isVencido = (dataVenc: string) =>
  new Date(dataVenc) < new Date(new Date().toISOString().split("T")[0]);

const isProximo = (dataVenc: string) => {
  const diff =
    new Date(dataVenc).getTime() - new Date(new Date().toISOString().split("T")[0]).getTime();
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

function getLembreteStatusInfo(lembrete: LembretePagamento) {
  if (lembrete.pagoCicloAtual) {
    return {
      label: "Pago",
      className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    };
  }

  if (!lembrete.ativo) {
    return {
      label: "Inativa",
      className: "bg-slate-100 text-slate-600 dark:bg-slate-700/80 dark:text-slate-300",
    };
  }

  const status = getStatusInfo(lembrete.dataVencimento);
  if (status.label === "Vencido") {
    return {
      label: "Vencida",
      className: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
    };
  }

  if (status.label === "Em dia") {
    return {
      label: "OK",
      className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    };
  }

  return {
    label: "Próxima",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  };
}

function getCanalResumo(
  lembrete: Pick<LembretePagamento, "lembreteTelegramAtivo" | "lembreteWhatsAppAtivo">
) {
  if (lembrete.lembreteTelegramAtivo && lembrete.lembreteWhatsAppAtivo) {
    return "Telegram + WhatsApp";
  }

  if (lembrete.lembreteTelegramAtivo) {
    return "Telegram";
  }

  if (lembrete.lembreteWhatsAppAtivo) {
    return "WhatsApp";
  }

  return "Sem lembretes";
}

export default function ContasFixasPage() {
  const { data: lembretes = [], isLoading, isError, error, refetch } = useLembretes(false);
  const { data: categorias = [] } = useCategorias();
  const { data: contasBancarias = [] } = useContasBancarias();
  const { data: cartoes = [] } = useCartoes();
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
  const [pagarCartaoId, setPagarCartaoId] = useState("");
  const [pagarData, setPagarData] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  const createForm = useForm<LembreteData>({
    resolver: zodResolver(lembreteSchema),
    defaultValues: {
      descricao: "",
      valor: "",
      dataVencimento: "",
      diaRecorrente: "",
      frequencia: "Unico",
      diaSemana: "",
      categoria: "",
      formaPagamento: "",
      lembreteTelegramAtivo: true,
      lembreteWhatsAppAtivo: true,
      dataFimRecorrencia: "",
    },
  });

  const editForm = useForm<LembreteData>({
    resolver: zodResolver(lembreteSchema),
    defaultValues: {
      descricao: "",
      valor: "",
      dataVencimento: "",
      diaRecorrente: "",
      frequencia: "Unico",
      diaSemana: "",
      categoria: "",
      formaPagamento: "",
      lembreteTelegramAtivo: true,
      lembreteWhatsAppAtivo: true,
      dataFimRecorrencia: "",
    },
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
      lembreteWhatsAppAtivo: lembrete.lembreteWhatsAppAtivo ?? true,
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
        diaRecorrente:
          data.frequencia === "Mensal" && data.diaRecorrente
            ? parseInt(data.diaRecorrente)
            : undefined,
        frequencia: isRecorrente ? (data.frequencia as FrequenciaLembrete) : undefined,
        diaSemanaRecorrente:
          (data.frequencia === "Semanal" || data.frequencia === "Quinzenal") && data.diaSemana
            ? parseInt(data.diaSemana)
            : undefined,
        categoria: data.categoria.trim(),
        formaPagamento: data.formaPagamento,
        lembreteTelegramAtivo: data.lembreteTelegramAtivo,
        lembreteWhatsAppAtivo: data.lembreteWhatsAppAtivo,
        dataFimRecorrencia:
          isRecorrente && data.dataFimRecorrencia ? data.dataFimRecorrencia : undefined,
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
          diaRecorrente:
            data.frequencia === "Mensal" && data.diaRecorrente
              ? parseInt(data.diaRecorrente)
              : undefined,
          frequencia: isRecorrente ? (data.frequencia as FrequenciaLembrete) : undefined,
          diaSemanaRecorrente:
            (data.frequencia === "Semanal" || data.frequencia === "Quinzenal") && data.diaSemana
              ? parseInt(data.diaSemana)
              : undefined,
          categoria: data.categoria.trim(),
          formaPagamento: data.formaPagamento,
          lembreteTelegramAtivo: data.lembreteTelegramAtivo,
          lembreteWhatsAppAtivo: data.lembreteWhatsAppAtivo,
          dataFimRecorrencia:
            isRecorrente && data.dataFimRecorrencia
              ? data.dataFimRecorrencia
              : isRecorrente
                ? undefined
                : "",
        },
      },
      { onSuccess: resetForm }
    );
  };

  const handleDesativar = () => {
    if (!deleteId) return;
    desativarLembrete.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
  };

  const handleAlterarAtivo = (id: number, ativo: boolean) => {
    atualizarLembrete.mutate({ id, data: { ativo } });
  };

  const openPagar = (l: LembretePagamento) => {
    const hoje = new Date().toISOString().split("T")[0];
    setPagarItem(l);
    setPagarValor(l.valor != null ? l.valor.toFixed(2).replace(".", ",") : "");
    setPagarContaBancariaId("");
    setPagarCartaoId("");
    setPagarData(hoje);
  };

  async function handlePagar(e: React.FormEvent) {
    e.preventDefault();
    if (!pagarItem) return;

    const ehCredito = pagarItem.formaPagamento?.toLowerCase() === "credito";
    const valorPago = parseFloat(pagarValor.replace(",", ".")) || undefined;
    const contaBancariaId = pagarContaBancariaId ? parseInt(pagarContaBancariaId) : undefined;
    const cartaoCreditoId = pagarCartaoId ? parseInt(pagarCartaoId) : undefined;

    if (ehCredito && !cartaoCreditoId) {
      toast.error("Selecione o cartao de credito para registrar esse pagamento.");
      return;
    }

    await pagarConta.mutateAsync({
      id: pagarItem.id,
      data: {
        valorPago,
        contaBancariaId: ehCredito ? undefined : contaBancariaId,
        cartaoCreditoId: ehCredito ? cartaoCreditoId : undefined,
        dataPagamento: pagarData || undefined,
      },
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
    const proximaVencer =
      ativos
        .filter((l) => !isVencido(l.dataVencimento))
        .sort(
          (a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime()
        )[0] ?? null;
    return { vencidos, proximos, total, count: ativos.length, proximaVencer };
  }, [lembretes]);

  const activeFilters = (filtroStatus !== "todos" ? 1 : 0) + (busca.trim() ? 1 : 0);

  const paged = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page, PAGE_SIZE]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagarEhCredito = pagarItem?.formaPagamento?.toLowerCase() === "credito";

  return (
    <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10">
      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl serif-italic text-slate-900 dark:text-white">
            Contas Fixas
          </h1>
          <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-slate-400">
            Gerenciamento de Compromissos Recorrentes
          </p>
        </div>
        <button
          onClick={() => {
            createForm.reset();
            setShowForm(true);
          }}
          className="bg-emerald-600 text-white px-5 sm:px-8 py-3 sm:py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-3 shadow-lg shadow-emerald-500/25 dark:shadow-emerald-500/20 cursor-pointer w-full sm:w-auto justify-center"
        >
          <Plus className="h-5 w-5" />
          Nova Conta Fixa
        </button>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────── */}
      {isLoading ? (
        <CardSkeleton count={3} />
      ) : isError ? (
        <ErrorState message={error?.message} onRetry={() => refetch()} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Card 1 – Valor Mensal Total */}
          <div className="exec-card p-5 sm:p-8 lg:p-10 rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] flex flex-col justify-center min-h-[140px] sm:min-h-[180px]">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em] mb-4">
              Valor Mensal Total
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl mono-data font-medium text-slate-900 dark:text-white">
                {formatCurrency(stats.total)}
              </span>
              <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">
                Comprometido
              </span>
            </div>
          </div>

          {/* Card 2 – Próxima a Vencer */}
          <div className="exec-card p-5 sm:p-8 lg:p-10 rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] flex flex-col justify-center min-h-[140px] sm:min-h-[180px]">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em] mb-4">
              Próxima a Vencer
            </p>
            {stats.proximaVencer ? (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-500/15 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="block text-lg font-semibold text-slate-900 dark:text-white leading-tight truncate">
                    {stats.proximaVencer.descricao}
                  </span>
                  <span className="text-[10px] mono-data text-slate-500 dark:text-slate-400 uppercase">
                    {(() => {
                      const d = new Date(stats.proximaVencer!.dataVencimento);
                      const months = [
                        "Jan",
                        "Fev",
                        "Mar",
                        "Abr",
                        "Mai",
                        "Jun",
                        "Jul",
                        "Ago",
                        "Set",
                        "Out",
                        "Nov",
                        "Dez",
                      ];
                      return `Vence em ${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} (${formatCurrency(stats.proximaVencer!.valor ?? 0)})`;
                    })()}
                  </span>
                </div>
              </div>
            ) : (
              <span className="text-sm font-medium text-slate-400">Nenhuma pendente</span>
            )}
          </div>

          {/* Card 3 – Contas Vencidas */}
          <div className="exec-card p-5 sm:p-8 lg:p-10 rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] flex flex-col justify-center min-h-[140px] sm:min-h-[180px]">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em] mb-4">
              Contas Vencidas
            </p>
            <div className="flex items-center gap-6">
              <span className="text-2xl sm:text-3xl lg:text-4xl mono-data font-bold text-rose-500">
                {String(stats.vencidos).padStart(2, "0")}
              </span>
              {stats.vencidos > 0 && (
                <span className="px-4 py-1.5 bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-200 rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  Atenção Necessária
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Main Table Card ─────────────────────────────────── */}
      <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] overflow-hidden">
        {/* Filter bar header */}
        <div className="p-4 sm:p-6 lg:p-8 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/20 dark:bg-slate-800/45 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Search className="h-4 w-4 text-slate-400" />
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {activeFilters > 0
                ? `Filtros Ativos: ${filtroStatus !== "todos" ? filtroStatus.charAt(0).toUpperCase() + filtroStatus.slice(1) : ""}${busca ? ` "${busca}"` : ""}`
                : "Filtros Ativos: Todos os Compromissos"}
            </h3>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: "todos", label: "Todos" },
                { key: "ativas", label: "Ativas" },
                { key: "inativas", label: "Inativas" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => {
                    setFiltroStatus(f.key);
                    setPage(0);
                  }}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all cursor-pointer",
                    filtroStatus === f.key
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700/80 dark:text-slate-200 dark:hover:bg-slate-700"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[244px] sm:flex-row sm:items-center">
              <div className="relative w-full">
                <input
                  id="contas-fixas-busca"
                  name="busca"
                  aria-label="Buscar contas fixas"
                  placeholder="Buscar..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="bg-white/95 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-700 rounded-full py-2 pl-4 pr-9 text-[10px] w-full outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600/30 transition-all text-slate-700 dark:text-slate-100 placeholder-slate-400 dark:placeholder:text-slate-500"
                />
                {busca && (
                  <button
                    onClick={() => setBusca("")}
                    aria-label="Limpar busca de contas fixas"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {activeFilters > 0 && (
                <button
                  onClick={() => {
                    setFiltroStatus("todos");
                    setBusca("");
                  }}
                  className="text-[9px] font-bold uppercase tracking-widest text-rose-500 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200 transition-colors cursor-pointer sm:ml-1"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-6 sm:p-8 lg:p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <p className="text-sm text-slate-500 dark:text-slate-300">Carregando contas fixas...</p>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="lg:hidden divide-y divide-slate-50 dark:divide-slate-800/80">
              {filtered.length === 0 ? (
                <div className="p-6 sm:p-8">
                  <EmptyState
                    icon={<CalendarClock className="h-6 w-6" />}
                    title={
                      activeFilters > 0
                        ? "Nenhum lembrete encontrado"
                        : "Nenhum lembrete cadastrado"
                    }
                    description={
                      activeFilters > 0
                        ? "Tente remover os filtros"
                        : "Adicione contas fixas para manter o controle"
                    }
                    action={
                      activeFilters > 0 ? (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setFiltroStatus("todos");
                            setBusca("");
                          }}
                          className="gap-2 rounded-xl"
                        >
                          <X className="h-4 w-4" /> Limpar filtros
                        </Button>
                      ) : (
                        <button
                          onClick={() => setShowForm(true)}
                          className="bg-emerald-600 text-white px-5 py-2.5 rounded-2xl font-medium shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer text-sm"
                        >
                          <Plus className="h-4 w-4" /> Criar primeiro lembrete
                        </button>
                      )
                    }
                  />
                </div>
              ) : (
                paged.map((l) => {
                  const catInfo = getCategoryIcon(l.categoria ?? "");
                  const CatIcon = catInfo.icon;
                  let statusLabel = getLembreteStatusInfo(l).label;
                  let statusClass = getLembreteStatusInfo(l).className;
                  if (l.pagoCicloAtual) {
                    statusLabel = "Pago";
                    statusClass =
                      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
                  } else if (!l.ativo) {
                    statusLabel = "Inativa";
                    statusClass =
                      "bg-slate-100 text-slate-600 dark:bg-slate-700/80 dark:text-slate-300";
                  } else if (isVencido(l.dataVencimento)) {
                    statusLabel = "Vencida";
                    statusClass = "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
                  } else {
                    const diff = Math.ceil(
                      (new Date(l.dataVencimento).getTime() -
                        new Date(new Date().toISOString().split("T")[0]).getTime()) /
                        86400000
                    );
                    if (diff <= 5) {
                      statusLabel = "Próxima";
                      statusClass =
                        "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
                    } else {
                      statusLabel = "OK";
                      statusClass =
                        "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
                    }
                  }
                  return (
                    <div
                      key={l.id}
                      className={cn("p-4 sm:p-5 space-y-2.5", !l.ativo && "opacity-60")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              "w-9 h-9 shrink-0 flex items-center justify-center rounded-xl",
                              catInfo.color
                            )}
                          >
                            <CatIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {l.descricao}
                            </h4>
                            <p className="text-xs mono-data font-bold text-slate-700 dark:text-slate-100">
                              {l.valor != null ? formatCurrency(l.valor) : "—"}
                            </p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest shrink-0",
                            statusClass
                          )}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                        <span>Venc: dia {l.diaRecorrente || "—"}</span>
                        <span>
                          {l.dataVencimento
                            ? (() => {
                                const d = new Date(l.dataVencimento);
                                const m = [
                                  "Jan",
                                  "Fev",
                                  "Mar",
                                  "Abr",
                                  "Mai",
                                  "Jun",
                                  "Jul",
                                  "Ago",
                                  "Set",
                                  "Out",
                                  "Nov",
                                  "Dez",
                                ];
                                return `${String(d.getDate()).padStart(2, "0")} ${m[d.getMonth()]}`;
                              })()
                            : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                        <span>{getCanalResumo(l)}</span>
                        <span>{l.ativo ? "Ativa" : "Inativa"}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        {l.ativo !== false && !l.pagoCicloAtual && (
                          <button
                            onClick={() => openPagar(l)}
                            aria-label={`Registrar pagamento de ${l.descricao}`}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300 dark:hover:bg-emerald-500/10 rounded-lg cursor-pointer"
                            title="Pagar"
                          >
                            <Banknote className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(l)}
                          aria-label={`Editar conta fixa ${l.descricao}`}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300 dark:hover:bg-emerald-500/10 rounded-lg cursor-pointer"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {l.ativo ? (
                          <button
                            onClick={() => setDeleteId(l.id)}
                            aria-label={`Desativar conta fixa ${l.descricao}`}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-200 dark:hover:bg-rose-500/10 rounded-lg cursor-pointer ml-auto"
                            title="Desativar"
                          >
                            <PowerOff className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAlterarAtivo(l.id, true)}
                            aria-label={`Ativar conta fixa ${l.descricao}`}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-200 dark:hover:bg-emerald-500/10 rounded-lg cursor-pointer ml-auto"
                            title="Ativar"
                          >
                            <Power className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop table — hidden on mobile */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/60">
                    <th className="px-10 py-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                      Descrição
                    </th>
                    <th className="px-6 py-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                      Valor Mensal
                    </th>
                    <th className="px-6 py-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                      Frequência
                    </th>
                    <th className="px-6 py-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">
                      Dia Venc.
                    </th>
                    <th className="px-6 py-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                      Próx. Vencimento
                    </th>
                    <th className="px-6 py-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                      Canais
                    </th>
                    <th className="px-6 py-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-10 py-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/80">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 sm:p-12">
                        <EmptyState
                          icon={<CalendarClock className="h-6 w-6" />}
                          title={
                            activeFilters > 0
                              ? "Nenhum lembrete encontrado"
                              : "Nenhum lembrete cadastrado"
                          }
                          description={
                            activeFilters > 0
                              ? "Tente remover os filtros para ver mais resultados"
                              : "Adicione contas fixas e lembretes de pagamento para manter o controle"
                          }
                          action={
                            activeFilters > 0 ? (
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setFiltroStatus("todos");
                                  setBusca("");
                                }}
                                className="gap-2 rounded-xl"
                              >
                                <X className="h-4 w-4" /> Limpar filtros
                              </Button>
                            ) : (
                              <button
                                onClick={() => setShowForm(true)}
                                className="bg-emerald-600 text-white px-5 py-2.5 rounded-2xl font-medium shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer text-sm"
                              >
                                <Plus className="h-4 w-4" /> Criar primeiro lembrete
                              </button>
                            )
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    paged.map((l) => {
                      const catInfo = getCategoryIcon(l.categoria ?? "");
                      const CatIcon = catInfo.icon;
                      const freqLabel =
                        l.frequencia === "Semanal"
                          ? "Semanal"
                          : l.frequencia === "Quinzenal"
                            ? "Quinzenal"
                            : l.frequencia === "Anual"
                              ? "Anual"
                              : l.recorrenteMensal || l.frequencia === "Mensal"
                                ? "Mensal"
                                : "Único";
                      const diaLabel = l.diaRecorrente ? `${l.diaRecorrente}` : "—";
                      const nextDate = l.ativo === false ? null : l.dataVencimento;
                      const nextFmt = nextDate
                        ? (() => {
                            const d = new Date(nextDate);
                            const months = [
                              "Jan",
                              "Fev",
                              "Mar",
                              "Abr",
                              "Mai",
                              "Jun",
                              "Jul",
                              "Ago",
                              "Set",
                              "Out",
                              "Nov",
                              "Dez",
                            ];
                            return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
                          })()
                        : "—";
                      let statusLabel = getLembreteStatusInfo(l).label;
                      let statusClass = getLembreteStatusInfo(l).className;
                      if (l.pagoCicloAtual) {
                        statusLabel = "Pago";
                        statusClass =
                          "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
                      } else if (!l.ativo) {
                        statusLabel = "Inativa";
                        statusClass =
                          "bg-slate-100 text-slate-600 dark:bg-slate-700/80 dark:text-slate-300";
                      } else if (isVencido(l.dataVencimento)) {
                        statusLabel = "Vencida";
                        statusClass =
                          "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
                      } else {
                        const diff = Math.ceil(
                          (new Date(l.dataVencimento).getTime() -
                            new Date(new Date().toISOString().split("T")[0]).getTime()) /
                            86400000
                        );
                        if (diff <= 5) {
                          statusLabel = "Próxima";
                          statusClass =
                            "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
                        } else {
                          statusLabel = "OK";
                          statusClass =
                            "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
                        }
                      }
                      return (
                        <tr
                          key={l.id}
                          className={cn(
                            "hover:bg-slate-50/50 dark:hover:bg-slate-800/35 transition-colors group",
                            !l.ativo && "opacity-60"
                          )}
                        >
                          <td className="px-10 py-6">
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "w-9 h-9 shrink-0 flex items-center justify-center rounded-xl",
                                  catInfo.color
                                )}
                              >
                                <CatIcon className="h-4 w-4" />
                              </div>
                              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                {l.descricao}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-6">
                            <span className="text-sm mono-data font-bold text-slate-700 dark:text-slate-100">
                              {l.valor != null ? formatCurrency(l.valor) : "—"}
                            </span>
                          </td>
                          <td className="px-6 py-6">
                            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-tighter">
                              {freqLabel}
                            </span>
                          </td>
                          <td className="px-6 py-6 text-center">
                            <span className="text-sm mono-data text-slate-600 dark:text-slate-300">
                              {diaLabel}
                            </span>
                          </td>
                          <td className="px-6 py-6">
                            <span
                              className={cn(
                                "text-[11px] mono-data uppercase",
                                isVencido(l.dataVencimento) &&
                                  l.ativo !== false &&
                                  !l.pagoCicloAtual
                                  ? "text-rose-500"
                                  : "text-slate-500 dark:text-slate-400"
                              )}
                            >
                              {nextFmt}
                            </span>
                          </td>
                          <td className="px-6 py-6">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:bg-slate-700/60 dark:text-slate-300">
                              {getCanalResumo(l)}
                            </span>
                          </td>
                          <td className="px-6 py-6">
                            <span
                              className={cn(
                                "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest",
                                statusClass
                              )}
                            >
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-10 py-6 text-right">
                            <div className="flex justify-end gap-2 opacity-100 lg:opacity-60 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 transition-opacity">
                              {l.ativo !== false && !l.pagoCicloAtual && (
                                <button
                                  onClick={() => openPagar(l)}
                                  aria-label={`Registrar pagamento de ${l.descricao}`}
                                  className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-300 dark:hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                                  title="Registrar pagamento"
                                >
                                  <Banknote className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={() => openEdit(l)}
                                aria-label={`Editar conta fixa ${l.descricao}`}
                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-300 dark:hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              {l.ativo ? (
                                <button
                                  onClick={() => setDeleteId(l.id)}
                                  aria-label={`Desativar conta fixa ${l.descricao}`}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-200 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                  title="Desativar"
                                >
                                  <PowerOff className="h-4 w-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleAlterarAtivo(l.id, true)}
                                  aria-label={`Ativar conta fixa ${l.descricao}`}
                                  className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-200 dark:hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                                  title="Ativar"
                                >
                                  <Power className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 lg:px-10 py-4 sm:py-6 border-t border-slate-50 dark:border-slate-800/80">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              Mostrando{" "}
              <span className="font-bold text-slate-700 dark:text-slate-100">
                {Math.min(page * PAGE_SIZE + 1, filtered.length)}–
                {Math.min((page + 1) * PAGE_SIZE, filtered.length)}
              </span>{" "}
              de{" "}
              <span className="font-bold text-slate-700 dark:text-slate-100">
                {filtered.length}
              </span>{" "}
              contas
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Ir para a página anterior de contas fixas"
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-widest border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Ir para a próxima página de contas fixas"
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-widest border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Próxima <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ New Bill Dialog ═══ */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-emerald-600/8 bg-emerald-600/3 p-3.5 sm:p-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-emerald-600/15 text-emerald-600 shadow-sm shadow-emerald-500/10 transition-all duration-500">
                <CalendarClock className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-semibold">
                  Nova Conta Fixa
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs sm:text-[13px] mt-0.5 truncate">
                  Configure sua conta fixa ou pagamento recorrente
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
              <div className="space-y-4 rounded-2xl border border-emerald-600/8 dark:border-slate-700/40 bg-white dark:bg-slate-800/60 shadow-[0_1px_6px_rgba(16,185,129,0.06)] dark:shadow-none p-4 sm:p-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Descrição
                  </Label>
                  <Input
                    placeholder="Ex: Aluguel, Internet, Energia..."
                    {...createForm.register("descricao")}
                    className={cn(
                      "h-11 rounded-xl border-border/40 bg-background placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all",
                      createForm.formState.errors.descricao && "border-red-500"
                    )}
                  />
                  {createForm.formState.errors.descricao && (
                    <p className="text-xs text-red-500 font-medium">
                      {createForm.formState.errors.descricao.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Valor (R$)
                  </Label>
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-11 sm:w-12 flex items-center justify-center rounded-l-xl text-sm font-bold bg-emerald-600/10 text-emerald-600">
                      R$
                    </div>
                    <CurrencyInput
                      placeholder="0,00"
                      className={cn(
                        "h-12 sm:h-14 rounded-xl pl-12 sm:pl-14 text-xl sm:text-2xl tabular-nums font-bold border-border/40 bg-background placeholder:text-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all",
                        createForm.formState.errors.valor && "border-red-500"
                      )}
                      value={createForm.watch("valor")}
                      onValueChange={(v) =>
                        createForm.setValue("valor", v, {
                          shouldValidate: createForm.formState.isSubmitted,
                        })
                      }
                    />
                  </div>
                  {createForm.formState.errors.valor && (
                    <p className="text-xs text-red-500 font-medium">
                      {createForm.formState.errors.valor.message}
                    </p>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Categoria
                    </Label>
                    <select
                      value={createForm.watch("categoria")}
                      onChange={(e) =>
                        createForm.setValue("categoria", e.target.value, { shouldValidate: true })
                      }
                      className={cn(
                        "h-11 w-full rounded-xl border border-border/40 bg-background px-3 text-sm",
                        createForm.formState.errors.categoria && "border-red-500"
                      )}
                    >
                      <option value="">Selecione</option>
                      {categorias.map((cat) => (
                        <option key={cat.id} value={cat.nome}>
                          {cat.nome}
                        </option>
                      ))}
                    </select>
                    {createForm.formState.errors.categoria && (
                      <p className="text-xs text-red-500 font-medium">
                        {createForm.formState.errors.categoria.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Forma de pagamento
                    </Label>
                    <select
                      value={createForm.watch("formaPagamento")}
                      onChange={(e) =>
                        createForm.setValue("formaPagamento", e.target.value, {
                          shouldValidate: true,
                        })
                      }
                      className={cn(
                        "h-11 w-full rounded-xl border border-border/40 bg-background px-3 text-sm",
                        createForm.formState.errors.formaPagamento && "border-red-500"
                      )}
                    >
                      <option value="">Selecione</option>
                      <option value="pix">PIX</option>
                      <option value="debito">Débito</option>
                      <option value="credito">Crédito</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="outro">Outro</option>
                    </select>
                    {createForm.formState.errors.formaPagamento && (
                      <p className="text-xs text-red-500 font-medium">
                        {createForm.formState.errors.formaPagamento.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Deseja receber lembretes por qual canal?
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        createForm.setValue("lembreteTelegramAtivo", true);
                        createForm.setValue("lembreteWhatsAppAtivo", true);
                      }}
                      className={cn(
                        "h-10 px-3 rounded-xl border text-sm font-medium cursor-pointer transition-all",
                        createForm.watch("lembreteTelegramAtivo") &&
                          createForm.watch("lembreteWhatsAppAtivo")
                          ? "border-emerald-600 bg-emerald-600/10 text-emerald-600"
                          : "border-border/40 text-muted-foreground"
                      )}
                    >
                      Ambos
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        createForm.setValue("lembreteTelegramAtivo", true);
                        createForm.setValue("lembreteWhatsAppAtivo", false);
                      }}
                      className={cn(
                        "h-10 px-3 rounded-xl border text-sm font-medium cursor-pointer transition-all",
                        createForm.watch("lembreteTelegramAtivo") &&
                          !createForm.watch("lembreteWhatsAppAtivo")
                          ? "border-emerald-600 bg-emerald-600/10 text-emerald-600"
                          : "border-border/40 text-muted-foreground"
                      )}
                    >
                      Telegram
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        createForm.setValue("lembreteTelegramAtivo", false);
                        createForm.setValue("lembreteWhatsAppAtivo", true);
                      }}
                      className={cn(
                        "h-10 px-3 rounded-xl border text-sm font-medium cursor-pointer transition-all",
                        !createForm.watch("lembreteTelegramAtivo") &&
                          createForm.watch("lembreteWhatsAppAtivo")
                          ? "border-emerald-600 bg-emerald-600/10 text-emerald-600"
                          : "border-border/40 text-muted-foreground"
                      )}
                    >
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        createForm.setValue("lembreteTelegramAtivo", false);
                        createForm.setValue("lembreteWhatsAppAtivo", false);
                      }}
                      className={cn(
                        "h-10 px-3 rounded-xl border text-sm font-medium cursor-pointer transition-all",
                        !createForm.watch("lembreteTelegramAtivo") &&
                          !createForm.watch("lembreteWhatsAppAtivo")
                          ? "border-emerald-600 bg-emerald-600/10 text-emerald-600"
                          : "border-border/40 text-muted-foreground"
                      )}
                    >
                      Nenhum
                    </button>
                  </div>
                </div>
              </div>

              {/* Frequency selector */}
              <div className="space-y-4 rounded-2xl border border-emerald-600/8 dark:border-slate-700/40 bg-white dark:bg-slate-800/60 shadow-[0_1px_6px_rgba(16,185,129,0.06)] dark:shadow-none p-4 sm:p-5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Frequência
                </Label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
                  {(
                    [
                      { key: "Unico" as const, label: "Único", icon: CalendarClock },
                      { key: "Semanal" as const, label: "Semanal", icon: Repeat },
                      { key: "Quinzenal" as const, label: "Quinzenal", icon: Repeat },
                      { key: "Mensal" as const, label: "Mensal", icon: Repeat },
                      { key: "Anual" as const, label: "Anual", icon: Calendar },
                    ] as const
                  ).map(({ key, label, icon: Icon }) => (
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
                      <span className="text-[10px] sm:text-xs font-semibold leading-tight">
                        {label}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="border-t border-border/20" />

                <AnimatePresence mode="wait">
                  {createForm.watch("frequencia") === "Unico" && (
                    <motion.div
                      key="unico"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-1.5"
                    >
                      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Data do Pagamento
                      </Label>
                      <div className="relative">
                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                        <Input
                          type="date"
                          {...createForm.register("dataVencimento")}
                          className={cn(
                            "h-11 rounded-xl pl-10 border-border/40 bg-background focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all",
                            createForm.formState.errors.dataVencimento && "border-red-500"
                          )}
                        />
                      </div>
                      {createForm.formState.errors.dataVencimento && (
                        <p className="text-xs text-red-500 font-medium">
                          {createForm.formState.errors.dataVencimento.message}
                        </p>
                      )}
                    </motion.div>
                  )}

                  {createForm.watch("frequencia") === "Mensal" && (
                    <motion.div
                      key="mensal"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-2"
                    >
                      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Dia do vencimento no mês
                      </Label>
                      <div className="relative">
                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          placeholder="Ex: 10"
                          {...createForm.register("diaRecorrente")}
                          className={cn(
                            "h-11 rounded-xl pl-10 border-border/40 bg-background placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all",
                            createForm.formState.errors.diaRecorrente && "border-red-500"
                          )}
                        />
                      </div>
                      {createForm.formState.errors.diaRecorrente && (
                        <p className="text-xs text-red-500 font-medium">
                          {createForm.formState.errors.diaRecorrente.message}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5">
                        <Repeat className="h-3 w-3" />
                        {createForm.watch("diaRecorrente")
                          ? `Pagamento todo dia ${createForm.watch("diaRecorrente")} de cada mês`
                          : "Informe o dia para repetir todo mês"}
                      </p>
                    </motion.div>
                  )}

                  {(createForm.watch("frequencia") === "Semanal" ||
                    createForm.watch("frequencia") === "Quinzenal") && (
                    <motion.div
                      key="semanal"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3"
                    >
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Dia da semana
                        </Label>
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
                        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Data do primeiro pagamento
                        </Label>
                        <div className="relative">
                          <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                          <Input
                            type="date"
                            {...createForm.register("dataVencimento")}
                            className={cn(
                              "h-11 rounded-xl pl-10 border-border/40 bg-background focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all",
                              createForm.formState.errors.dataVencimento && "border-red-500"
                            )}
                          />
                        </div>
                        {createForm.formState.errors.dataVencimento && (
                          <p className="text-xs text-red-500 font-medium">
                            {createForm.formState.errors.dataVencimento.message}
                          </p>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5">
                        <Repeat className="h-3 w-3" />
                        {createForm.watch("frequencia") === "Semanal"
                          ? "Repete toda semana"
                          : "Repete a cada 15 dias"}
                        {createForm.watch("diaSemana")
                          ? ` (${DIAS_SEMANA[parseInt(createForm.watch("diaSemana") || "0")]})`
                          : ""}
                      </p>
                    </motion.div>
                  )}

                  {createForm.watch("frequencia") === "Anual" && (
                    <motion.div
                      key="anual"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-2"
                    >
                      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Data do pagamento anual
                      </Label>
                      <div className="relative">
                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                        <Input
                          type="date"
                          {...createForm.register("dataVencimento")}
                          className={cn(
                            "h-11 rounded-xl pl-10 border-border/40 bg-background focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all",
                            createForm.formState.errors.dataVencimento && "border-red-500"
                          )}
                        />
                      </div>
                      {createForm.formState.errors.dataVencimento && (
                        <p className="text-xs text-red-500 font-medium">
                          {createForm.formState.errors.dataVencimento.message}
                        </p>
                      )}
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
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Até quando pagar? <span className="text-muted-foreground/40">(opcional)</span>
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                      <Input
                        type="date"
                        {...createForm.register("dataFimRecorrencia")}
                        className="h-11 rounded-xl pl-10 border-border/40 bg-background focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5">
                      <CalendarClock className="h-3 w-3" />
                      {createForm.watch("dataFimRecorrencia")
                        ? `Lembretes serão enviados até ${new Date(createForm.watch("dataFimRecorrencia") + "T12:00:00").toLocaleDateString("pt-BR")}`
                        : "Se não informar, o lembrete continuará indefinidamente"}
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
        </DialogContent>
      </Dialog>

      {/* ═══ Edit Dialog ═══ */}
      <Dialog open={editItem !== null} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-emerald-600/8 bg-emerald-600/3 p-3.5 sm:p-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-emerald-600/15 text-emerald-600 shadow-sm shadow-emerald-500/10">
                <Pencil className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-semibold">
                  Editar Conta Fixa
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs sm:text-[13px] mt-0.5 truncate">
                  Altere os dados da conta fixa
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <form
              onSubmit={editForm.handleSubmit(handleAtualizar)}
              className="space-y-4 sm:space-y-5"
            >
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Descrição
                </Label>
                <Input
                  {...editForm.register("descricao")}
                  className={cn(
                    "h-11 rounded-xl",
                    editForm.formState.errors.descricao && "border-red-500"
                  )}
                />
                {editForm.formState.errors.descricao && (
                  <p className="text-xs text-red-500 font-medium">
                    {editForm.formState.errors.descricao.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Valor (R$)
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <CurrencyInput
                    placeholder="0,00"
                    className={cn(
                      "h-11 rounded-xl pl-9 tabular-nums",
                      editForm.formState.errors.valor && "border-red-500"
                    )}
                    value={editForm.watch("valor") ?? ""}
                    onValueChange={(v) =>
                      editForm.setValue("valor", v, {
                        shouldValidate: editForm.formState.isSubmitted,
                      })
                    }
                  />
                </div>
                {editForm.formState.errors.valor && (
                  <p className="text-xs text-red-500 font-medium">
                    {editForm.formState.errors.valor.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Categoria
                  </Label>
                  <select
                    value={editForm.watch("categoria")}
                    onChange={(e) =>
                      editForm.setValue("categoria", e.target.value, { shouldValidate: true })
                    }
                    className={cn(
                      "h-11 w-full rounded-xl border border-border/40 bg-background px-3 text-sm",
                      editForm.formState.errors.categoria && "border-red-500"
                    )}
                  >
                    <option value="">Selecione</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.nome}>
                        {cat.nome}
                      </option>
                    ))}
                  </select>
                  {editForm.formState.errors.categoria && (
                    <p className="text-xs text-red-500 font-medium">
                      {editForm.formState.errors.categoria.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Forma de pagamento
                  </Label>
                  <select
                    value={editForm.watch("formaPagamento")}
                    onChange={(e) =>
                      editForm.setValue("formaPagamento", e.target.value, { shouldValidate: true })
                    }
                    className={cn(
                      "h-11 w-full rounded-xl border border-border/40 bg-background px-3 text-sm",
                      editForm.formState.errors.formaPagamento && "border-red-500"
                    )}
                  >
                    <option value="">Selecione</option>
                    <option value="pix">PIX</option>
                    <option value="debito">Débito</option>
                    <option value="credito">Crédito</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="outro">Outro</option>
                  </select>
                  {editForm.formState.errors.formaPagamento && (
                    <p className="text-xs text-red-500 font-medium">
                      {editForm.formState.errors.formaPagamento.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Deseja receber lembretes por qual canal?
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      editForm.setValue("lembreteTelegramAtivo", true);
                      editForm.setValue("lembreteWhatsAppAtivo", true);
                    }}
                    className={cn(
                      "h-10 px-3 rounded-xl border text-sm font-medium cursor-pointer transition-all",
                      editForm.watch("lembreteTelegramAtivo") &&
                        editForm.watch("lembreteWhatsAppAtivo")
                        ? "border-emerald-600 bg-emerald-600/10 text-emerald-600"
                        : "border-border/40 text-muted-foreground"
                    )}
                  >
                    Ambos
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      editForm.setValue("lembreteTelegramAtivo", true);
                      editForm.setValue("lembreteWhatsAppAtivo", false);
                    }}
                    className={cn(
                      "h-10 px-3 rounded-xl border text-sm font-medium cursor-pointer transition-all",
                      editForm.watch("lembreteTelegramAtivo") &&
                        !editForm.watch("lembreteWhatsAppAtivo")
                        ? "border-emerald-600 bg-emerald-600/10 text-emerald-600"
                        : "border-border/40 text-muted-foreground"
                    )}
                  >
                    Telegram
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      editForm.setValue("lembreteTelegramAtivo", false);
                      editForm.setValue("lembreteWhatsAppAtivo", true);
                    }}
                    className={cn(
                      "h-10 px-3 rounded-xl border text-sm font-medium cursor-pointer transition-all",
                      !editForm.watch("lembreteTelegramAtivo") &&
                        editForm.watch("lembreteWhatsAppAtivo")
                        ? "border-emerald-600 bg-emerald-600/10 text-emerald-600"
                        : "border-border/40 text-muted-foreground"
                    )}
                  >
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      editForm.setValue("lembreteTelegramAtivo", false);
                      editForm.setValue("lembreteWhatsAppAtivo", false);
                    }}
                    className={cn(
                      "h-10 px-3 rounded-xl border text-sm font-medium cursor-pointer transition-all",
                      !editForm.watch("lembreteTelegramAtivo") &&
                        !editForm.watch("lembreteWhatsAppAtivo")
                        ? "border-emerald-600 bg-emerald-600/10 text-emerald-600"
                        : "border-border/40 text-muted-foreground"
                    )}
                  >
                    Nenhum
                  </button>
                </div>
              </div>

              {/* Frequency selector */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Frequência
                </Label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {(
                    [
                      { key: "Unico" as const, label: "Único" },
                      { key: "Semanal" as const, label: "Semanal" },
                      { key: "Quinzenal" as const, label: "Quinz." },
                      { key: "Mensal" as const, label: "Mensal" },
                      { key: "Anual" as const, label: "Anual" },
                    ] as const
                  ).map(({ key, label }) => (
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
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Data do Pagamento
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input
                      type="date"
                      {...editForm.register("dataVencimento")}
                      className={cn(
                        "h-11 rounded-xl pl-9",
                        editForm.formState.errors.dataVencimento && "border-red-500"
                      )}
                    />
                  </div>
                  {editForm.formState.errors.dataVencimento && (
                    <p className="text-xs text-red-500 font-medium">
                      {editForm.formState.errors.dataVencimento.message}
                    </p>
                  )}
                </div>
              )}

              {editForm.watch("frequencia") === "Mensal" && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Dia do vencimento no mês
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    placeholder="Ex: 10"
                    {...editForm.register("diaRecorrente")}
                    className={cn(
                      "h-11 rounded-xl",
                      editForm.formState.errors.diaRecorrente && "border-red-500"
                    )}
                  />
                  {editForm.formState.errors.diaRecorrente && (
                    <p className="text-xs text-red-500 font-medium">
                      {editForm.formState.errors.diaRecorrente.message}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                    <Repeat className="h-3 w-3" />
                    {editForm.watch("diaRecorrente")
                      ? `Todo dia ${editForm.watch("diaRecorrente")} de cada mês`
                      : "Informe o dia"}
                  </p>
                </div>
              )}

              {(editForm.watch("frequencia") === "Semanal" ||
                editForm.watch("frequencia") === "Quinzenal") && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Dia da semana
                    </Label>
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
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Data do primeiro pagamento
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                      <Input
                        type="date"
                        {...editForm.register("dataVencimento")}
                        className={cn(
                          "h-11 rounded-xl pl-9",
                          editForm.formState.errors.dataVencimento && "border-red-500"
                        )}
                      />
                    </div>
                    {editForm.formState.errors.dataVencimento && (
                      <p className="text-xs text-red-500 font-medium">
                        {editForm.formState.errors.dataVencimento.message}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {editForm.watch("frequencia") === "Anual" && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Data do pagamento anual
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input
                      type="date"
                      {...editForm.register("dataVencimento")}
                      className={cn(
                        "h-11 rounded-xl pl-9",
                        editForm.formState.errors.dataVencimento && "border-red-500"
                      )}
                    />
                  </div>
                  {editForm.formState.errors.dataVencimento && (
                    <p className="text-xs text-red-500 font-medium">
                      {editForm.formState.errors.dataVencimento.message}
                    </p>
                  )}
                </div>
              )}

              {/* Optional end date for recurring bills */}
              {editForm.watch("frequencia") !== "Unico" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Até quando pagar? <span className="text-muted-foreground/40">(opcional)</span>
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input
                      type="date"
                      {...editForm.register("dataFimRecorrencia")}
                      className="h-11 rounded-xl pl-9"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" />
                    {editForm.watch("dataFimRecorrencia")
                      ? `Até ${new Date(editForm.watch("dataFimRecorrencia") + "T12:00:00").toLocaleDateString("pt-BR")}`
                      : "Sem data limite"}
                  </p>
                </div>
              )}

              <div className="pt-2 sm:pt-3 pb-safe">
                <Button
                  type="submit"
                  className="w-full h-12 sm:h-13 rounded-xl sm:rounded-2xl gap-2 sm:gap-2.5 font-bold text-sm sm:text-[15px] bg-emerald-600 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                  loading={atualizarLembrete.isPending}
                >
                  <CheckCircle2 className="h-5 w-5" />
                  Salvar alterações
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
            <AlertDialogTitle className="sr-only">Desativar conta fixa?</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              Tem certeza que deseja desativar esta conta fixa? O historico sera preservado.
            </AlertDialogDescription>
            <DialogShellHeader
              icon={<Trash2 className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Desativar conta fixa?"
              description="Tem certeza que deseja desativar esta conta fixa? O historico sera preservado."
              tone="rose"
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDesativar}
              loading={desativarLembrete.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ Payment Dialog ═══ */}
      <Dialog
        open={pagarItem !== null}
        onOpenChange={(open) => {
          if (!open) setPagarItem(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-emerald-600/8 bg-emerald-600/3 p-3.5 sm:p-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-emerald-600/15 text-emerald-600 shadow-sm shadow-emerald-500/10 fade-in zoom-in duration-300">
                <Banknote className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-semibold">
                  Registrar Pagamento
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs sm:text-[13px] mt-0.5 truncate">
                  {pagarItem?.descricao}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handlePagar} className="space-y-4 sm:space-y-5">
            {/* Valor */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Valor Pago (R$)
              </Label>
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
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Data do Pagamento
              </Label>
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

            {pagarEhCredito ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Cartão de crédito
                </Label>
                <Select value={pagarCartaoId} onValueChange={setPagarCartaoId}>
                  <SelectTrigger className="h-11 rounded-xl border-border/40 bg-background dark:bg-slate-800 dark:border-slate-700">
                    <SelectValue placeholder="Selecionar cartao..." />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-700">
                    {cartoes.map((cartao) => (
                      <SelectItem
                        key={cartao.id}
                        value={String(cartao.id)}
                        className="dark:focus:bg-slate-800"
                      >
                        {cartao.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Conta Bancária{" "}
                  <span className="text-muted-foreground/40 normal-case">(opcional)</span>
                </Label>
                <Select value={pagarContaBancariaId} onValueChange={setPagarContaBancariaId}>
                  <SelectTrigger className="h-11 rounded-xl border-border/40 bg-background dark:bg-slate-800 dark:border-slate-700">
                    <SelectValue placeholder="Selecionar conta..." />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-700">
                    {contasBancarias.map((conta) => (
                      <SelectItem
                        key={conta.id}
                        value={String(conta.id)}
                        className="dark:focus:bg-slate-800"
                      >
                        {conta.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPagarItem(null)}
                className="h-12 rounded-xl flex-1 font-semibold dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={pagarConta.isPending}
                className="h-12 rounded-xl flex-1 gap-2 font-semibold text-sm bg-emerald-600 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle2 className="h-5 w-5" />
                Confirmar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
