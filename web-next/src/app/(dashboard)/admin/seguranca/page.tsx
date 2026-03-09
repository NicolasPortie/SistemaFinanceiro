"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  Download,
  LogOut,
  Lock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Wifi,
  AlertTriangle,
  Clock,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import {
  api,
  type AdminSegurancaResumo,
  type AdminSessao,
  type AdminUsuarioBloqueado,
} from "@/lib/api";
import { formatDate } from "@/lib/format";
import { ErrorState } from "@/components/shared/page-components";
import { DialogShellHeader } from "@/components/shared/dialog-shell";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────

interface SidebarUser {
  id: number;
  nome: string;
  email: string | null;
  sessoes: AdminSessao[];
  bloqueado: AdminUsuarioBloqueado | null;
}

// ── Helpers ────────────────────────────────────────────────

function maskNome(nome: string) {
  if (!nome) return "";
  const visible = nome.slice(0, 2);
  return visible + "*".repeat(Math.max(0, nome.length - 2));
}

function maskIp(ip: string | null) {
  if (!ip) return "—";
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.***`;
  const v6 = ip.split(":");
  if (v6.length > 4) return v6.slice(0, 4).join(":") + ":****";
  return ip.slice(0, Math.ceil(ip.length / 2)) + "***";
}

function isExpired(s: AdminSessao) {
  return new Date(s.expiraEm) < new Date();
}

function getTimeRemaining(expiraEm: string) {
  const now = new Date();
  const exp = new Date(expiraEm);
  const diff = exp.getTime() - now.getTime();
  if (diff <= 0) return "Expirada";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const rem = hours % 24;
    return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function timeSince(dateStr: string) {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 0) return "Agora";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Agora";
  if (mins < 60) return `${mins}m atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

function avgDuration(sessoes: AdminSessao[]) {
  if (!sessoes.length) return "—";
  const now = new Date();
  const total = sessoes.reduce((sum, s) => {
    const start = new Date(s.criadoEm).getTime();
    const end = isExpired(s) ? new Date(s.expiraEm).getTime() : now.getTime();
    return sum + (end - start);
  }, 0);
  const avgMs = total / sessoes.length;
  const hours = Math.floor(avgMs / (1000 * 60 * 60));
  const minutes = Math.floor((avgMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

// ── Page ───────────────────────────────────────────────────

export default function AdminSegurancaPage() {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [revogarAlvo, setRevogarAlvo] = useState<AdminSessao | null>(null);
  const [showRevogarTodas, setShowRevogarTodas] = useState(false);

  const { data, isLoading, error } = useQuery<AdminSegurancaResumo>({
    queryKey: ["admin", "seguranca"],
    queryFn: () => api.admin.seguranca.resumo(),
  });

  const revogarSessao = useMutation({
    mutationFn: (tokenId: number) =>
      api.admin.seguranca.revogarSessao(tokenId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Sessão encerrada com sucesso");
      setRevogarAlvo(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revogarTodas = useMutation({
    mutationFn: () => api.admin.seguranca.revogarTodas(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Todas as sessões foram encerradas");
      setShowRevogarTodas(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Build sidebar user list ─────────────────────────────

  const users = useMemo<SidebarUser[]>(() => {
    if (!data) return [];
    const map = new Map<number, SidebarUser>();

    data.sessoes.forEach((s) => {
      if (!map.has(s.usuarioId)) {
        map.set(s.usuarioId, {
          id: s.usuarioId,
          nome: s.usuarioNome,
          email: null,
          sessoes: [],
          bloqueado: null,
        });
      }
      map.get(s.usuarioId)!.sessoes.push(s);
    });

    data.usuariosBloqueadosLista.forEach((u) => {
      if (!map.has(u.id)) {
        map.set(u.id, {
          id: u.id,
          nome: u.nome,
          email: u.email,
          sessoes: [],
          bloqueado: u,
        });
      } else {
        const existing = map.get(u.id)!;
        existing.bloqueado = u;
        existing.email = u.email;
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const aActive = a.sessoes.filter((s) => !isExpired(s)).length;
      const bActive = b.sessoes.filter((s) => !isExpired(s)).length;
      return bActive - aActive;
    });
  }, [data]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.nome.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q))
    );
  }, [users, searchQuery]);

  // Auto-select first user
  useEffect(() => {
    if (users.length && selectedUserId === null) {
      setSelectedUserId(users[0].id);
    }
  }, [users, selectedUserId]);

  const selectedUser = users.find((u) => u.id === selectedUserId) ?? null;

  // ── Loading ────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-full">
        <aside className="w-96 shrink-0 hidden lg:block bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 p-6">
          <Skeleton className="h-6 w-48 mb-4" />
          <Skeleton className="h-10 w-full mb-6 rounded-xl" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full mb-3 rounded-xl" />
          ))}
        </aside>
        <div className="flex-1 p-4 sm:p-6 lg:p-10">
          <Skeleton className="h-10 w-80 mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-[2rem]" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <ErrorState
          message="Erro ao carregar dados de segurança."
          onRetry={() =>
            queryClient.invalidateQueries({ queryKey: ["admin", "seguranca"] })
          }
        />
      </div>
    );
  }

  // ── Derived data for selected user ──────────────────────

  const activeSessions = selectedUser
    ? selectedUser.sessoes.filter((s) => !isExpired(s))
    : [];

  const sessionsSorted = selectedUser
    ? [...selectedUser.sessoes].sort(
        (a, b) =>
          new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
      )
    : [];

  const primaryIp = selectedUser
    ? (() => {
        const ipCount = new Map<string, number>();
        selectedUser.sessoes.forEach((s) => {
          if (s.ipCriacao) {
            ipCount.set(s.ipCriacao, (ipCount.get(s.ipCriacao) ?? 0) + 1);
          }
        });
        let best: string | null = null;
        let max = 0;
        ipCount.forEach((count, ip) => {
          if (count > max) {
            best = ip;
            max = count;
          }
        });
        return best;
      })()
    : null;

  const riskLevel = selectedUser
    ? selectedUser.bloqueado
      ? "Alto"
      : activeSessions.length > 5
        ? "Médio"
        : "Baixo"
    : "—";

  const riskColor = selectedUser?.bloqueado
    ? "text-rose-500"
    : activeSessions.length > 5
      ? "text-amber-500"
      : "text-emerald-600";

  return (
    <>
      <div className="flex h-full min-h-0">
        {/* ━━ Sidebar ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <aside className="w-96 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 hidden lg:flex flex-col overflow-hidden">
          {/* Sidebar header */}
          <div className="p-6 border-b border-slate-50 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl serif-italic text-slate-900 dark:text-slate-100">
                Contas de Usuários
              </h2>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">
                {users.length} Total
              </span>
            </div>
            <div className="relative">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por usuário ou e-mail..."
                className="bg-slate-50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2.5 text-[11px] placeholder:text-slate-300 focus:ring-1 focus:ring-emerald-500 h-auto"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 h-4 w-4" />
            </div>
          </div>

          {/* Sidebar user list */}
          <div className="flex-1 overflow-y-auto hide-scrollbar">
            <AnimatePresence initial={false}>
              {filteredUsers.map((user) => {
                const active = user.sessoes.filter(
                  (s) => !isExpired(s)
                ).length;
                const latest = user.sessoes.length
                  ? new Date(
                      Math.max(
                        ...user.sessoes.map((s) =>
                          new Date(s.criadoEm).getTime()
                        )
                      )
                    ).toISOString()
                  : null;
                const isSelected = selectedUserId === user.id;

                return (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedUserId(user.id)}
                    className={cn(
                      "cursor-pointer transition-all border-l-4 border-transparent hover:bg-slate-50/80 dark:hover:bg-slate-800/50 p-5",
                      isSelected &&
                        "bg-white dark:bg-slate-800 border-emerald-500 shadow-sm"
                    )}
                  >
                    {/* Row 1: Name + session badge */}
                    <div className="flex justify-between items-start mb-1">
                      <h3
                        className={cn(
                          "font-bold text-sm truncate max-w-45",
                          isSelected
                            ? "text-slate-900 dark:text-slate-100"
                            : "text-slate-700 dark:text-slate-300"
                        )}
                      >
                        {maskNome(user.nome)}
                      </h3>
                      <span
                        className={cn(
                          "text-[9px] font-bold px-2 py-0.5 rounded-full",
                          active > 0
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                            : "bg-slate-50 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                        )}
                      >
                        {active}{" "}
                        {active === 1 ? "Sessão" : "Sessões"}
                      </span>
                    </div>

                    {/* Row 2: Email */}
                    {user.email && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-medium text-slate-400 truncate">
                          {user.email}
                        </span>
                      </div>
                    )}

                    {/* Row 3: Last active + chevron */}
                    <div className="mt-3 flex items-center justify-between text-[9px] text-slate-400">
                      {latest ? (
                        <span className="flex items-center gap-1">
                          {active > 0 && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          )}
                          Última atividade: {timeSince(latest)}
                        </span>
                      ) : (
                        <span>Sem sessões</span>
                      )}
                      {isSelected && (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredUsers.length === 0 && (
              <div className="px-6 py-14 text-center">
                <Shield className="h-8 w-8 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-[11px] text-slate-400">
                  {searchQuery
                    ? "Nenhum usuário encontrado."
                    : "Nenhuma sessão ativa."}
                </p>
              </div>
            )}
          </div>

          {/* Sidebar footer: session progress bar */}
          <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              <span>Total Sessões Ativas</span>
              <span>{data.sessoesAtivas}</span>
            </div>
            <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{
                  width: `${Math.min(100, (data.sessoesAtivas / Math.max(1, data.sessoes.length)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </aside>

        {/* ━━ Detail Panel ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="flex-1 overflow-y-auto ivory-bg dark:bg-slate-950 p-4 sm:p-6 lg:p-10 hide-scrollbar">
          {/* Mobile user picker */}
          <div className="lg:hidden mb-4">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Selecionar Usuário</label>
            <select
              value={selectedUserId ?? ""}
              onChange={(e) => setSelectedUserId(Number(e.target.value))}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
            >
              {filteredUsers.map((u) => (
                <option key={u.id} value={u.id}>{maskNome(u.nome)} ({u.sessoes.filter(s => !isExpired(s)).length} sessões)</option>
              ))}
            </select>
          </div>
          {selectedUser ? (
            <div className="max-w-5xl mx-auto space-y-8">
              {/* ── Header ── */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                      Auditoria de Segurança
                    </span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Usuário: #USR-{selectedUser.id}
                    </span>
                  </div>
                  <h1 className="text-3xl serif-italic text-slate-900 dark:text-slate-100">
                    {maskNome(selectedUser.nome)}
                  </h1>
                  {selectedUser.bloqueado ? (
                    <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Conta Bloqueada •{" "}
                      {selectedUser.bloqueado.tentativasLoginFalhadas}{" "}
                      tentativas falhadas
                      {selectedUser.bloqueado.bloqueadoAte &&
                        ` • Até ${formatDate(selectedUser.bloqueado.bloqueadoAte)}`}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500 mt-1">
                      {selectedUser.sessoes.length} sessões registradas •
                      Conta gerenciada
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <button className="flex items-center gap-2 px-5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                    <Download className="h-3.5 w-3.5" />
                    Exportar Logs
                  </button>
                  {activeSessions.length > 0 && (
                    <button
                      onClick={() => setShowRevogarTodas(true)}
                      className="flex items-center gap-2 px-5 py-2 border border-rose-200 dark:border-rose-500/30 text-rose-500 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Encerrar Todas as Sessões
                    </button>
                  )}
                </div>
              </div>

              {/* ── 4 Stat Cards (glass-card) ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                <div className="glass-card rounded-2xl p-5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    Sessões Ativas
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {String(activeSessions.length).padStart(2, "0")}
                    </span>
                    {activeSessions.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                  </div>
                </div>

                <div className="glass-card rounded-2xl p-5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    Duração Média
                  </span>
                  <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {avgDuration(selectedUser.sessoes)}
                  </span>
                </div>

                <div className="glass-card rounded-2xl p-5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    IP Principal
                  </span>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100 mono-data">
                    {primaryIp ? maskIp(primaryIp) : "—"}
                  </span>
                </div>

                <div className="glass-card rounded-2xl p-5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    Risco
                  </span>
                  <span className={cn("text-2xl font-bold", riskColor)}>
                    {riskLevel}
                  </span>
                </div>
              </div>

              {/* ── Sessions Table (glass-card rounded-[2rem]) ── */}
              <div className="glass-card rounded-[2rem] overflow-hidden">
                {/* Table header */}
                <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Sessões Ativas &amp; Recentes
                  </h3>
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                      Ativa
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                      Encerrada
                    </span>
                  </div>
                </div>

                {sessionsSorted.length > 0 ? (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-900/50">
                        <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          IP de Acesso
                        </th>
                        <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          Início da Sessão
                        </th>
                        <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          Encerramento / Últ. Atividade
                        </th>
                        <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">
                          Ação
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {sessionsSorted.map((s) => {
                        const expired = isExpired(s);
                        return (
                          <tr
                            key={s.id}
                            className={cn(
                              "transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30",
                              expired && "bg-slate-50/20 dark:bg-slate-900/20"
                            )}
                          >
                            {/* IP */}
                            <td
                              className={cn(
                                "px-6 py-5",
                                expired && "opacity-60"
                              )}
                            >
                              <div>
                                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mono-data">
                                  {maskIp(s.ipCriacao)}
                                </p>
                              </div>
                            </td>

                            {/* Login time */}
                            <td
                              className={cn(
                                "px-6 py-5",
                                expired && "opacity-60"
                              )}
                            >
                              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                                {formatDate(s.criadoEm)}
                              </p>
                            </td>

                            {/* Status / logout */}
                            <td className="px-6 py-5">
                              {expired ? (
                                <p className="text-[11px] text-slate-400 italic">
                                  Encerrada ({formatDate(s.expiraEm)})
                                </p>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                                  Ativa — {getTimeRemaining(s.expiraEm)}{" "}
                                  restante
                                </span>
                              )}
                            </td>

                            {/* Action */}
                            <td className="px-6 py-5 text-right">
                              {!expired ? (
                                <button
                                  onClick={() => setRevogarAlvo(s)}
                                  className="text-[9px] font-bold text-rose-400 hover:text-rose-600 uppercase tracking-widest transition-colors"
                                >
                                  Encerrar
                                </button>
                              ) : (
                                <Lock className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 inline-block" />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-6 py-14 text-center">
                    <Wifi className="h-8 w-8 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                    <p className="text-[11px] text-slate-400">
                      Nenhuma sessão registrada para este usuário.
                    </p>
                  </div>
                )}
              </div>

              {/* ── Security Event Log (glass-card rounded-[2rem]) ── */}
              <div className="glass-card rounded-[2rem] p-8">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Registro de Eventos de Segurança
                </h3>

                <div className="space-y-6">
                  {/* Session events */}
                  {sessionsSorted.slice(0, 5).map((s) => {
                    const expired = isExpired(s);
                    return (
                      <div
                        key={`evt-${s.id}`}
                        className="flex gap-6 items-start"
                      >
                        <div
                          className={cn(
                            "p-2 rounded-lg shrink-0",
                            expired
                              ? "bg-slate-50 dark:bg-slate-800"
                              : "bg-emerald-50 dark:bg-emerald-500/10"
                          )}
                        >
                          {expired ? (
                            <LogOut className="h-4.5 w-4.5 text-slate-400" />
                          ) : (
                            <ShieldCheck className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              {expired
                                ? "Sessão Encerrada"
                                : "Login com Sucesso"}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {formatDate(s.criadoEm)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {expired ? (
                              <>
                                Sessão expirada em{" "}
                                <span className="font-bold text-slate-600 dark:text-slate-300">
                                  {formatDate(s.expiraEm)}
                                </span>
                                . IP:{" "}
                                <span className="font-bold text-slate-600 dark:text-slate-300 mono-data">
                                  {maskIp(s.ipCriacao)}
                                </span>
                                .
                              </>
                            ) : (
                              <>
                                Autenticação realizada. IP de acesso:{" "}
                                <span className="font-bold text-slate-600 dark:text-slate-300 mono-data">
                                  {maskIp(s.ipCriacao)}
                                </span>
                                . Expira em {getTimeRemaining(s.expiraEm)}.
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  {/* Blocked user event */}
                  {selectedUser.bloqueado && (
                    <div className="flex gap-6 items-start">
                      <div className="p-2 bg-rose-50 dark:bg-rose-500/10 rounded-lg shrink-0">
                        <AlertTriangle className="h-4.5 w-4.5 text-rose-600 dark:text-rose-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Tentativa de Login Falhada
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Conta bloqueada por excesso de tentativas (
                          {selectedUser.bloqueado.tentativasLoginFalhadas}{" "}
                          falhas).
                          {selectedUser.bloqueado.bloqueadoAte && (
                            <>
                              {" "}
                              Desbloqueio automático em{" "}
                              <span className="font-bold text-rose-500 dark:text-rose-400 underline">
                                {formatDate(
                                  selectedUser.bloqueado.bloqueadoAte
                                )}
                              </span>
                              .
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedUser.sessoes.length === 0 &&
                    !selectedUser.bloqueado && (
                      <p className="text-[11px] text-slate-400 text-center py-4">
                        Nenhum evento de segurança registrado.
                      </p>
                    )}
                </div>
              </div>
            </div>
          ) : (
            /* ── Empty state ── */
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Shield className="h-12 w-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                <p className="text-sm text-slate-400">
                  Selecione um usuário para visualizar os detalhes de
                  segurança.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ━━ Modals ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      {/* Encerrar sessão individual */}
      <AlertDialog
        open={!!revogarAlvo}
        onOpenChange={() => setRevogarAlvo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader className="items-start text-left">
            <AlertDialogTitle className="sr-only">
              Encerrar sessão?
            </AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              O usuário será deslogado imediatamente e precisará fazer login
              novamente.
            </AlertDialogDescription>
            <DialogShellHeader
              icon={<LogOut className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Encerrar esta sessão?"
              description="O usuário será deslogado imediatamente e precisará fazer login novamente."
              tone="rose"
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                revogarAlvo && revogarSessao.mutate(revogarAlvo.id)
              }
              loading={revogarSessao.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl gap-2"
            >
              <LogOut className="h-4 w-4" />
              Encerrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Encerrar todas */}
      <AlertDialog open={showRevogarTodas} onOpenChange={setShowRevogarTodas}>
        <AlertDialogContent>
          <AlertDialogHeader className="items-start text-left">
            <AlertDialogTitle className="sr-only">
              Encerrar TODAS as sessões?
            </AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              Isso vai deslogar todos os usuários do sistema.
            </AlertDialogDescription>
            <DialogShellHeader
              icon={<LogOut className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Encerrar todas as sessões?"
              description="Isso vai deslogar todos os usuários do sistema, incluindo você. Use somente em caso de emergência ou suspeita de acesso não autorizado."
              tone="rose"
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revogarTodas.mutate()}
              loading={revogarTodas.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl gap-2"
            >
              <LogOut className="h-4 w-4" />
              Encerrar Todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
