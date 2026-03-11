"use client";

import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Trash2,
  Copy,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  Link2,
  Timer,
  ShieldCheck,
  Loader2,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { api, type AdminCodigoConvite } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { ErrorState } from "@/components/shared/page-components";
import { DialogShellHeader } from "@/components/shared/dialog-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import { cn } from "@/lib/utils";

// ── Helpers ─────────────────────────────────────────────────

function formatDuration(dias: number | null): string {
  if (!dias) return "Permanente";
  if (dias >= 365) {
    const anos = Math.floor(dias / 365);
    const mesesRestantes = Math.floor((dias % 365) / 30);
    return mesesRestantes > 0 ? `${anos} ano(s) e ${mesesRestantes} mês(es)` : `${anos} ano(s)`;
  }
  if (dias >= 30) {
    const meses = Math.floor(dias / 30);
    const diasRestantes = dias % 30;
    return diasRestantes > 0 ? `${meses} mês(es) e ${diasRestantes} dia(s)` : `${meses} mês(es)`;
  }
  return `${dias} dia(s)`;
}

function getPlanoVinculado(dias: number | null): string {
  return dias === null || dias >= 7 ? "Individual" : "Acesso temporário";
}

function getStatus(c: AdminCodigoConvite) {
  if (c.usado && !c.ilimitado)
    return {
      label: "Usado",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      darkBg: "dark:bg-emerald-500/10",
      darkBorder: "dark:border-emerald-500/20",
      icon: CheckCircle2,
    };
  if (c.expirado)
    return {
      label: "Expirado",
      color: "text-rose-600",
      bg: "bg-rose-50",
      border: "border-rose-100",
      darkBg: "dark:bg-rose-500/10",
      darkBorder: "dark:border-rose-500/20",
      icon: XCircle,
    };
  if (c.usosRealizados > 0 && !c.usado)
    return {
      label: "Em Uso",
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-100",
      darkBg: "dark:bg-amber-500/10",
      darkBorder: "dark:border-amber-500/20",
      icon: Users,
    };
  return {
    label: "Disponível",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    darkBg: "dark:bg-emerald-500/10",
    darkBorder: "dark:border-emerald-500/20",
    icon: Clock,
  };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Agora";
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d atrás`;
  return formatDate(dateStr);
}

const PRESETS_ACESSO = [
  { label: "7 dias", value: 7 },
  { label: "15 dias", value: 15 },
  { label: "30 dias", value: 30 },
  { label: "90 dias", value: 90 },
  { label: "6 meses", value: 180 },
  { label: "1 ano", value: 365 },
];

const PRESETS_EXPIRACAO = [
  { label: "24h", value: 24 },
  { label: "48h", value: 48 },
  { label: "72h", value: 72 },
  { label: "7 dias", value: 168 },
  { label: "30 dias", value: 720 },
];

// ── Page ────────────────────────────────────────────────────

export default function AdminConvitesPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  // Create form state
  const [descricao, setDescricao] = useState("");
  const [horasValidade, setHorasValidade] = useState(48);
  const [codigoPermanente, setCodigoPermanente] = useState(false);
  const [diasAcesso, setDiasAcesso] = useState(30);
  const [acessoPermanente, setAcessoPermanente] = useState(false);
  const [quantidade, setQuantidade] = useState(1);

  const {
    data: convites,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin", "convites"],
    queryFn: () => api.admin.convites.listar(),
  });
  const criar = useMutation({
    mutationFn: () =>
      api.admin.convites.criar({
        descricao: descricao || undefined,
        horasValidade: codigoPermanente ? 0 : horasValidade,
        diasAcesso: acessoPermanente ? 0 : diasAcesso,
        quantidade,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "convites"] });
      if (data.length === 1) {
        const link = `${window.location.origin}/registro?convite=${data[0].codigo}`;
        navigator.clipboard.writeText(link).catch(() => {});
        toast.success("Link gerado e copiado!");
        setSelectedId(data[0].id);
      } else {
        toast.success(`${data.length} links gerados com sucesso!`);
      }
      handleCloseCreate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remover = useMutation({
    mutationFn: (id: number) => api.admin.convites.remover(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "convites"] });
      toast.success("Link removido");
      if (removingId === selectedId) setSelectedId(null);
      setRemovingId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCloseCreate = () => {
    setShowCreate(false);
    setDescricao("");
    setHorasValidade(48);
    setCodigoPermanente(false);
    setDiasAcesso(30);
    setAcessoPermanente(false);
    setQuantidade(1);
  };

  const copiarCodigo = async (codigo: string) => {
    try {
      const link = `${window.location.origin}/registro?convite=${codigo}`;
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado!");
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  // Auto-select first on load
  const autoSelectedRef = useRef(false);
  if (convites?.length && selectedId === null && !autoSelectedRef.current) {
    autoSelectedRef.current = true;
    setSelectedId(convites[0].id);
  }

  const selectedConvite = convites?.find((c) => c.id === selectedId) ?? null;

  // Sidebar filtering
  const sortedConvites = useMemo(() => {
    if (!convites) return [];
    let list = [...convites].sort(
      (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
    );
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.codigo.toLowerCase().includes(q) ||
          c.descricao?.toLowerCase().includes(q) ||
          c.criadoPorNome.toLowerCase().includes(q) ||
          c.usadoPorNome?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [convites, searchQuery]);

  const ativos = convites?.filter((c) => !c.usado && !c.expirado) ?? [];

  // ── Loading ──────────────
  if (isLoading) {
    return (
      <div className="flex h-full">
        <aside className="w-96 shrink-0 hidden lg:block bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 p-6">
          <Skeleton className="h-6 w-40 mb-4" />
          <Skeleton className="h-10 w-full mb-6 rounded-xl" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full mb-3 rounded-xl" />
          ))}
        </aside>
        <div className="flex-1 p-4 sm:p-6 lg:p-10">
          <Skeleton className="h-10 w-80 mb-8" />
          <Skeleton className="h-64 w-full rounded-[2rem]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <ErrorState
          message="Erro ao carregar convites."
          onRetry={() => queryClient.invalidateQueries({ queryKey: ["admin", "convites"] })}
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full min-h-0">
        {/* ── Sidebar ── */}
        <aside className="w-96 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 hidden lg:flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-50 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl serif-italic">Convites Enviados</h2>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">
                {convites?.length ?? 0} Total
              </span>
            </div>
            <div className="relative">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por código..."
                className="bg-slate-50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2.5 text-[11px] placeholder:text-slate-300 focus:ring-1 focus:ring-emerald-500 h-auto"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto hide-scrollbar">
            <AnimatePresence>
              {sortedConvites.map((c) => {
                const status = getStatus(c);
                return (
                  <motion.button
                    key={c.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "w-full text-left p-5 cursor-pointer transition-all border-l-4 border-transparent hover:bg-slate-50/80 dark:hover:bg-slate-800/50",
                      selectedId === c.id &&
                        "bg-white dark:bg-slate-800 border-emerald-500 shadow-sm",
                      c.expirado && selectedId !== c.id && "opacity-70"
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h3
                        className={cn(
                          "font-mono font-bold text-sm truncate max-w-45",
                          selectedId === c.id
                            ? "text-foreground"
                            : "text-slate-600 dark:text-slate-300"
                        )}
                      >
                        {c.codigo}
                      </h3>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider border",
                          status.bg,
                          status.color,
                          status.border,
                          status.darkBg,
                          status.darkBorder
                        )}
                      >
                        {status.label}
                      </span>
                    </div>
                    {c.descricao && (
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">{c.descricao}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between text-[9px] text-slate-400">
                      <span>{timeAgo(c.criadoEm)}</span>
                      {c.usadoPorNome && (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {c.usadoPorNome}
                        </span>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>

          <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">
              <span>Disponíveis</span>
              <span>
                {String(ativos.length).padStart(2, "0")} /{" "}
                {String(convites?.length ?? 0).padStart(2, "0")}
              </span>
            </div>
            <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{
                  width: convites?.length ? `${(ativos.length / convites.length) * 100}%` : "0%",
                }}
              />
            </div>
          </div>
        </aside>

        {/* ── Detail Panel ── */}
        <section className="flex-1 overflow-y-auto hide-scrollbar p-6 lg:p-10">
          {/* Mobile selector */}
          <div className="lg:hidden mb-6">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
              Selecionar Convite
            </label>
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-emerald-500"
            >
              {sortedConvites.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} — {getStatus(c).label}
                </option>
              ))}
            </select>
          </div>

          {selectedConvite ? (
            <motion.div
              key={selectedConvite.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                      Detalhes do Convite
                    </span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      #{selectedConvite.id}
                    </span>
                  </div>
                  <h1 className="text-2xl lg:text-3xl serif-italic font-mono">
                    {selectedConvite.codigo}
                  </h1>
                </div>
                <div className="flex items-center gap-3">
                  {!selectedConvite.usado && !selectedConvite.expirado && (
                    <Button
                      variant="outline"
                      onClick={() => setRemovingId(selectedConvite.id)}
                      className="flex items-center gap-2 px-5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:border-rose-500 hover:text-rose-500 transition-all"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Revogar
                    </Button>
                  )}
                  <Button
                    onClick={() => copiarCodigo(selectedConvite.codigo)}
                    className="flex items-center gap-2 px-5 py-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-lg falcon-glow"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar Link
                  </Button>
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Convite info */}
                <div className="exec-card rounded-[2rem] p-6 lg:col-span-2">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <Link2 className="h-3.5 w-3.5" /> Informações do Convite
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        Link Completo
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 text-[10px] text-slate-500 dark:text-slate-400 flex-1 truncate">
                          /registro?convite={selectedConvite.codigo}
                        </code>
                        <button
                          onClick={() => copiarCodigo(selectedConvite.codigo)}
                          className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        Duração do Acesso
                      </span>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm font-bold text-emerald-600">
                          {formatDuration(selectedConvite.duracaoAcessoDias)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        Vínculo do usuário
                      </span>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {getPlanoVinculado(selectedConvite.duracaoAcessoDias)}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {selectedConvite.duracaoAcessoDias === null ||
                        selectedConvite.duracaoAcessoDias >= 7
                          ? "Ao aceitar este convite, o usuário entra com plano Individual liberado."
                          : "Convites com menos de 7 dias criam apenas acesso temporário, sem vínculo ao plano Individual."}
                      </p>
                    </div>
                    {selectedConvite.descricao && (
                      <div className="sm:col-span-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                          Descrição
                        </span>
                        <p className="text-sm text-slate-700 dark:text-slate-200">
                          {selectedConvite.descricao}
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        Criado por
                      </span>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {selectedConvite.criadoPorNome}
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        Criado em
                      </span>
                      <p className="text-sm text-slate-700 dark:text-slate-200">
                        {formatDate(selectedConvite.criadoEm)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status & Expiry */}
                <div className="exec-card rounded-[2rem] p-6">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <Timer className="h-3.5 w-3.5" /> Status & Expiração
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                        Status Atual
                      </span>
                      {(() => {
                        const status = getStatus(selectedConvite);
                        return (
                          <span
                            className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-bold uppercase border",
                              status.bg,
                              status.color,
                              status.border,
                              status.darkBg,
                              status.darkBorder
                            )}
                          >
                            {status.label}
                          </span>
                        );
                      })()}
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        {selectedConvite.permanente
                          ? "Validade"
                          : selectedConvite.expirado
                            ? "Expirou em"
                            : "Expira em"}
                      </span>
                      {selectedConvite.permanente ? (
                        <p className="text-sm font-bold text-emerald-600">Sem prazo</p>
                      ) : selectedConvite.expiraEm ? (
                        <>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            {formatDate(selectedConvite.expiraEm)}
                          </p>
                          {!selectedConvite.expirado && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {timeAgo(selectedConvite.expiraEm)}
                            </p>
                          )}
                        </>
                      ) : null}
                    </div>
                    {selectedConvite.usoMaximo !== null && (
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                          Usos
                        </span>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                          {selectedConvite.usosRealizados} /{" "}
                          {selectedConvite.ilimitado ? "∞" : selectedConvite.usoMaximo}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Used by (if used) */}
              {selectedConvite.usado && selectedConvite.usadoPorNome && (
                <div className="exec-card rounded-[2rem] p-8">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" /> Evento de Uso
                  </h3>
                  <div className="flex gap-6">
                    <div className="relative">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-50 dark:ring-emerald-500/20" />
                      <div className="absolute left-0.75 top-4 w-px h-8 bg-slate-100 dark:bg-slate-700" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                          Convite aceito por{" "}
                          <span className="font-semibold text-emerald-600 underline">
                            {selectedConvite.usadoPorNome}
                          </span>
                        </span>
                        {selectedConvite.usadoEm && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            {formatDate(selectedConvite.usadoEm)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Acesso concedido com duração de {formatDuration(selectedConvite.duracaoAcessoDias)} e vínculo {getPlanoVinculado(selectedConvite.duracaoAcessoDias).toLowerCase()}.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
              <p className="text-[11px] uppercase tracking-widest font-bold">
                {convites?.length ? "Selecione um convite na lista" : "Nenhum convite gerado"}
              </p>
              {!convites?.length && (
                <Button
                  onClick={() => setShowCreate(true)}
                  className="gap-2 px-6 py-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all falcon-glow"
                >
                  <Plus className="h-4 w-4" />
                  Gerar Primeiro Link
                </Button>
              )}
            </div>
          )}

          {/* Floating create button */}
          {convites?.length ? (
            <button
              onClick={() => setShowCreate(true)}
              className="fixed bottom-8 right-8 bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-lg falcon-glow flex items-center gap-2 z-40"
            >
              <Plus className="h-4 w-4" />
              Novo Convite
            </button>
          ) : null}
        </section>
      </div>

      {/* ── Remove Dialog ── */}
      <AlertDialog open={removingId !== null} onOpenChange={() => setRemovingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader className="items-start text-left">
            <AlertDialogTitle className="sr-only">Remover link de cadastro?</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              Esta ação não pode ser desfeita. O link será removido permanentemente.
            </AlertDialogDescription>
            <DialogShellHeader
              icon={<Trash2 className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Remover link de cadastro?"
              description="Esta ação não pode ser desfeita. O link será removido permanentemente."
              tone="rose"
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removingId && remover.mutate(removingId)}
              loading={remover.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Create Dialog ── */}
      <Dialog open={showCreate} onOpenChange={(open) => !open && handleCloseCreate()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-emerald-600/8 bg-emerald-600/3 p-3.5 sm:p-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-emerald-600/15 text-emerald-600 shadow-sm shadow-emerald-500/10">
                <Link2 className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <DialogTitle className="text-lg sm:text-xl font-semibold">
                  Gerar Link de Cadastro
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs sm:text-[13px] mt-0.5">
                  Configure as permissões e validade para o novo acesso.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Duração do Acesso */}
            <div>
              <Label className="block text-sm font-semibold text-foreground mb-2">
                Duração do Acesso
              </Label>
              <div className="mb-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-[11px] leading-5 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                Convites com acesso permanente ou duração de 7 dias ou mais liberam o usuário no plano Individual. Durações menores criam acesso temporário sem esse vínculo.
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {PRESETS_ACESSO.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      setDiasAcesso(p.value);
                      setAcessoPermanente(false);
                    }}
                    className={cn(
                      "px-3 py-2 text-sm font-medium rounded-xl border transition-colors",
                      !acessoPermanente && diasAcesso === p.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:border-border/80"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  placeholder="Personalizado"
                  value={acessoPermanente ? "" : diasAcesso}
                  onChange={(e) => {
                    setAcessoPermanente(false);
                    setDiasAcesso(Math.max(1, Number(e.target.value)));
                  }}
                  className="pr-14 h-10 rounded-full bg-muted/30 border-border/60"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  dias
                </span>
              </div>
              <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border/30">
                <div>
                  <p className="text-sm font-semibold">Acesso permanente</p>
                  <p className="text-[11px] text-muted-foreground/60">
                    Sem prazo de expiração e com vínculo ao plano Individual
                  </p>
                </div>
                <Switch
                  id="acessoPermanente"
                  checked={acessoPermanente}
                  onCheckedChange={setAcessoPermanente}
                />
              </div>
            </div>

            {/* Expiração do Link */}
            <div>
              <Label className="block text-sm font-semibold text-foreground mb-2">
                Expiração do Link
              </Label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {PRESETS_EXPIRACAO.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      setHorasValidade(p.value);
                      setCodigoPermanente(false);
                    }}
                    className={cn(
                      "px-3 py-2 text-sm font-medium rounded-xl border transition-colors",
                      !codigoPermanente && horasValidade === p.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:border-border/80"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  max={87600}
                  placeholder="Personalizado"
                  value={codigoPermanente ? "" : horasValidade}
                  onChange={(e) => {
                    setCodigoPermanente(false);
                    setHorasValidade(Math.max(1, Number(e.target.value)));
                  }}
                  className="pr-16 h-10 rounded-full bg-muted/30 border-border/60"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  horas
                </span>
              </div>
              <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border/30">
                <div>
                  <p className="text-sm font-semibold">Sem prazo (nunca expira)</p>
                  <p className="text-[11px] text-muted-foreground/60">
                    O link pode ser usado a qualquer momento
                  </p>
                </div>
                <Switch
                  id="codigoPermanente"
                  checked={codigoPermanente}
                  onCheckedChange={setCodigoPermanente}
                />
              </div>
            </div>

            {/* Uso Único */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Uso Único</p>
                <p className="text-[11px] text-muted-foreground/60">
                  O convite expira após o primeiro uso
                </p>
              </div>
              <Switch checked id="usoUnico" disabled />
            </div>

            {/* Quantidade + Descrição */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Quantidade
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={quantidade}
                  onChange={(e) => setQuantidade(Math.max(1, Math.min(50, Number(e.target.value))))}
                  className="h-10 rounded-full bg-muted/30 border-border/60"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Descrição (opcional)
                </Label>
                <Input
                  placeholder="Ex: RH novos"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="h-10 rounded-full bg-muted/30 border-border/60"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={handleCloseCreate} className="rounded-full">
              Cancelar
            </Button>
            <Button
              onClick={() => criar.mutate()}
              disabled={criar.isPending}
              className="gap-2 rounded-full font-bold bg-slate-900 dark:bg-white dark:text-slate-900 text-white hover:bg-slate-800 dark:hover:bg-slate-200 falcon-glow"
            >
              {criar.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Gerar{quantidade > 1 ? ` ${quantidade} Links` : " Link"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
