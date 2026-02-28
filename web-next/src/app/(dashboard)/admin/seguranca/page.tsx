"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type AdminSegurancaResumo, type AdminSessao } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Monitor,
  LogOut,
  ShieldAlert,
  Globe,
  Search,
  Power,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Wifi,
} from "lucide-react";
import { useState, useMemo } from "react";
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
import { motion, AnimatePresence } from "framer-motion";
import { PageShell, ErrorState, CardSkeleton } from "@/components/shared/page-components";
import { cn } from "@/lib/utils";

// ── Helpers ────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-blue-500",
  "bg-rose-500",
  "bg-amber-600",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-teal-500",
];

function getAvatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function getInitials(nome: string) {
  return nome
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
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
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const PAGE_SIZE = 10;

// ── Page ───────────────────────────────────────────────────

export default function AdminSegurancaPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [revogarAlvo, setRevogarAlvo] = useState<AdminSessao | null>(null);
  const [showRevogarTodas, setShowRevogarTodas] = useState(false);

  const { data, isLoading, isError, error } = useQuery<AdminSegurancaResumo>({
    queryKey: ["admin", "seguranca"],
    queryFn: () => api.admin.seguranca.resumo(),
  });

  const revogarSessao = useMutation({
    mutationFn: (tokenId: number) => api.admin.seguranca.revogarSessao(tokenId),
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

  // ── Search + pagination ────────────────────────────────
  const filtered = useMemo(() => {
    const sessoes = data?.sessoes ?? [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return sessoes;
    return sessoes.filter(
      (s) => s.usuarioNome.toLowerCase().includes(q) || s.usuarioEmail.toLowerCase().includes(q)
    );
  }, [data?.sessoes, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleSearch(v: string) {
    setSearchQuery(v);
    setCurrentPage(1);
  }

  // ── Pagination numbers ─────────────────────────────────
  function getPageNumbers() {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push("...");
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) {
        pages.push(i);
      }
      if (safePage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }

  // ── Loading / Error ────────────────────────────────────
  if (isLoading) {
    return (
      <PageShell>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Segurança Global</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitore e gerencie as sessões ativas da plataforma
          </p>
        </div>
        <CardSkeleton count={3} />
      </PageShell>
    );
  }

  if (isError || !data) {
    return (
      <PageShell>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Segurança Global</h1>
        </div>
        <ErrorState
          message={error?.message ?? "Erro ao carregar dados"}
          onRetry={() => queryClient.invalidateQueries({ queryKey: ["admin", "seguranca"] })}
        />
      </PageShell>
    );
  }

  const startItem = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <PageShell>
      {/* Title */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold">Segurança Global</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitore e gerencie as sessões ativas da plataforma
        </p>
      </motion.div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-7">
        {(
          [
            {
              label: "Sessões Ativas",
              value: data.sessoesAtivas,
              icon: Monitor,
              color: "text-emerald-500",
              bg: "bg-emerald-500/10",
              gradient: "from-emerald-500/5",
              subtitle: "dados reais",
              subtitleExtra: "em tempo real",
            },
            {
              label: "Usuários Bloqueados",
              value: data.usuariosBloqueados,
              icon: ShieldAlert,
              color: data.usuariosBloqueados > 0 ? "text-red-400" : "text-muted-foreground",
              bg: data.usuariosBloqueados > 0 ? "bg-red-500/10" : "bg-muted/60",
              gradient: data.usuariosBloqueados > 0 ? "from-red-500/5" : "from-muted/5",
              subtitle: data.usuariosBloqueados > 0 ? "atenção" : "tudo certo",
              subtitleExtra: "por excesso de tentativas",
            },
            {
              label: "Tentativas Falhadas",
              value: data.tentativasLoginFalhadas,
              icon: Globe,
              color: data.tentativasLoginFalhadas > 0 ? "text-amber-400" : "text-muted-foreground",
              bg: data.tentativasLoginFalhadas > 0 ? "bg-amber-500/10" : "bg-muted/60",
              gradient: data.tentativasLoginFalhadas > 0 ? "from-amber-500/5" : "from-muted/5",
              subtitle: data.tentativasLoginFalhadas > 0 ? "monitorar" : "tudo certo",
              subtitleExtra: "total acumulado",
            },
          ] as const
        ).map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, ease: [0.22, 1, 0.36, 1] as const }}
            whileHover={{ y: -2 }}
            className="bg-card rounded-2xl p-6 border border-border/60 shadow-sm relative overflow-hidden"
          >
            <div
              className={cn(
                "absolute right-0 top-0 h-full w-24 bg-linear-to-l to-transparent pointer-events-none",
                card.gradient
              )}
            />
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                <h3 className="text-3xl font-bold mt-1 tabular-nums">
                  {card.value.toLocaleString("pt-BR")}
                </h3>
              </div>
              <div className={cn("p-3 rounded-xl", card.bg)}>
                <card.icon className={cn("h-5 w-5", card.color)} />
              </div>
            </div>
            <div className="flex items-center text-sm">
              <span
                className={cn(
                  "font-medium flex items-center px-2 py-0.5 rounded mr-2 text-xs",
                  card.bg,
                  card.color
                )}
              >
                <TrendingUp className="h-3 w-3 mr-1" />
                {card.subtitle}
              </span>
              <span className="text-muted-foreground text-xs">{card.subtitleExtra}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, ease: [0.22, 1, 0.36, 1] as const }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-bold whitespace-nowrap">Sessões Ativas</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Buscar por usuário..."
              className="pl-9 pr-3 h-9 text-sm rounded-lg w-full sm:w-64 bg-muted/40 border-border/60 focus:bg-background focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground whitespace-nowrap">
            {filtered.length === 0 ? "Nenhum resultado" : `${filtered.length} sessão(ões)`}
          </p>
          {data.sessoesAtivas > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-9 rounded-lg text-xs font-medium text-red-500 border-red-500/20 bg-red-500/5 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors"
              onClick={() => setShowRevogarTodas(true)}
            >
              <Power className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Encerrar Todas as Sessões</span>
              <span className="sm:hidden">Encerrar Todas</span>
            </Button>
          )}
        </div>
      </motion.div>

      {/* ── Table ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, ease: [0.22, 1, 0.36, 1] as const }}
        className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                <th className="px-6 py-3.5">Usuário</th>
                <th className="px-6 py-3.5">IP</th>
                <th className="px-6 py-3.5">Data de Início</th>
                <th className="px-6 py-3.5">Expira em</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              <AnimatePresence>
                {paginated.map((s, i) => {
                  const expired = isExpired(s);
                  return (
                    <motion.tr
                      key={s.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 6 }}
                      transition={{ delay: i * 0.025 }}
                      className={cn(
                        "group transition-colors hover:bg-emerald-500/3",
                        expired && "opacity-60"
                      )}
                    >
                      {/* Usuário */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-xs",
                              getAvatarColor(s.usuarioId)
                            )}
                          >
                            {getInitials(s.usuarioNome)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold leading-tight">{s.usuarioNome}</p>
                            <p className="text-xs text-muted-foreground/60 mt-0.5">
                              {s.usuarioEmail}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* IP */}
                      <td className="px-6 py-4">
                        <p className="text-xs text-muted-foreground font-mono">
                          {s.ipCriacao || "—"}
                        </p>
                      </td>

                      {/* Data de Início */}
                      <td className="px-6 py-4">
                        <p className="text-sm text-muted-foreground">{formatDate(s.criadoEm)}</p>
                      </td>

                      {/* Expira em */}
                      <td className="px-6 py-4">
                        <p
                          className={cn(
                            "text-sm font-medium tabular-nums",
                            expired ? "text-red-500" : "text-muted-foreground"
                          )}
                        >
                          {getTimeRemaining(s.expiraEm)}
                        </p>
                        <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                          {formatDate(s.expiraEm)}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {expired ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                            Expirada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Ativa
                          </span>
                        )}
                      </td>

                      {/* Ação */}
                      <td className="px-6 py-4 text-right">
                        {!expired && (
                          <button
                            onClick={() => setRevogarAlvo(s)}
                            className="text-muted-foreground/50 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                            title="Encerrar Sessão"
                          >
                            <Power className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>

              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center">
                    <Wifi className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery
                        ? "Nenhuma sessão corresponde à busca."
                        : "Nenhuma sessão ativa no momento."}
                    </p>
                    <p className="text-xs text-muted-foreground/50 mt-1">
                      {searchQuery
                        ? "Tente outro termo de busca."
                        : "Quando alguém fizer login, a sessão aparecerá aqui."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {filtered.length > 0 && (
          <div className="border-t border-border/40 px-6 py-4 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground hidden sm:block">
              Mostrando <span className="font-semibold text-foreground">{startItem}</span> a{" "}
              <span className="font-semibold text-foreground">{endItem}</span> de{" "}
              <span className="font-semibold text-foreground">{filtered.length}</span> sessões
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 rounded-lg text-xs gap-1"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Anterior
              </Button>

              {getPageNumbers().map((p, idx) =>
                p === "..." ? (
                  <span key={`dots-${idx}`} className="px-2 text-muted-foreground text-sm">
                    ...
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={safePage === p ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-9 w-9 p-0 rounded-lg text-xs",
                      safePage === p &&
                        "bg-emerald-500 hover:bg-emerald-600 border-emerald-500 shadow shadow-emerald-500/20"
                    )}
                    onClick={() => setCurrentPage(p as number)}
                  >
                    {p}
                  </Button>
                )
              )}

              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 rounded-lg text-xs gap-1"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Encerrar sessão individual ── */}
      <AlertDialog open={!!revogarAlvo} onOpenChange={() => setRevogarAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar sessão de {revogarAlvo?.usuarioNome}?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário será deslogado imediatamente e precisará fazer login novamente. Use isso se
              suspeitar que a conta está sendo acessada indevidamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revogarAlvo && revogarSessao.mutate(revogarAlvo.id)}
              loading={revogarSessao.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Encerrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Encerrar todas ── */}
      <AlertDialog open={showRevogarTodas} onOpenChange={setShowRevogarTodas}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar TODAS as sessões?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai deslogar <strong>todos os usuários</strong> do sistema, incluindo você. Todos
              precisarão fazer login novamente. Use somente em caso de emergência ou suspeita de
              acesso não autorizado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revogarTodas.mutate()}
              loading={revogarTodas.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Encerrar Todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
