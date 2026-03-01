"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type AdminUsuario } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Users,
  ShieldOff,
  Crown,
  Ban,
  Unlock,
  RotateCcw,
  Eye,
  UserX,
  UserCheck,
  LogOut,
  MoreHorizontal,
  Send,
  CalendarClock,
  ShieldCheck,
  Search,
  Download,
  SlidersHorizontal,
  UserPlus,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Target,
  Shield,
  Mail,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Skeleton } from "@/components/ui/skeleton";

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

function maskNome(nome: string) {
  if (!nome) return "";
  const visible = nome.slice(0, 2);
  const rest = nome.slice(2);
  return visible + "*".repeat(Math.max(0, rest.length));
}

function maskEmail(email: string) {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visibleLocal = local.slice(0, 2);
  const maskedLocal = visibleLocal + "*".repeat(Math.max(0, local.length - 2));
  const domainParts = domain.split(".");
  const ext = domainParts[domainParts.length - 1];
  const domainName = domainParts.slice(0, -1).join(".");
  const maskedDomain = "*".repeat(Math.max(1, domainName.length)) + "." + ext;
  return maskedLocal + "@" + maskedDomain;
}

const PAGE_SIZE = 10;

const isBloqueado = (u: AdminUsuario) => !!u.bloqueadoAte && new Date(u.bloqueadoAte) > new Date();

function getStatusBadge(u: AdminUsuario) {
  if (isBloqueado(u)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Bloqueado
      </span>
    );
  }
  if (!u.ativo) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-500/20">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        Inativo
      </span>
    );
  }
  if (u.acessoExpiraEm && new Date(u.acessoExpiraEm) < new Date()) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/20">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
        Expirado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Ativo
    </span>
  );
}

function getRoleBadge(role: string) {
  if (role === "Admin") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
        Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
      Usuário
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────

export default function AdminUsuariosPage() {
  const queryClient = useQueryClient();
  const { usuario: currentUser } = useAuth();
  const [selectedUser, setSelectedUser] = useState<AdminUsuario | null>(null);
  const [extendTarget, setExtendTarget] = useState<AdminUsuario | null>(null);
  const [extendDias, setExtendDias] = useState(30);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState<{
    label: string;
    description: string;
    variant?: "destructive" | "default";
    onConfirm: () => void;
  } | null>(null);

  const {
    data: usuarios,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["admin", "usuarios"],
    queryFn: () => api.admin.usuarios.listar(),
  });

  const mutationOpts = (msg: string) => ({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.success(msg);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bloquear = useMutation({
    mutationFn: (id: number) => api.admin.usuarios.bloquear(id),
    ...mutationOpts("Usuário bloqueado"),
  });
  const desbloquear = useMutation({
    mutationFn: (id: number) => api.admin.usuarios.desbloquear(id),
    ...mutationOpts("Usuário desbloqueado"),
  });
  const desativar = useMutation({
    mutationFn: (id: number) => api.admin.usuarios.desativar(id),
    ...mutationOpts("Status da conta alterado"),
  });
  const resetarLogin = useMutation({
    mutationFn: (id: number) => api.admin.usuarios.resetarLogin(id),
    ...mutationOpts("Tentativas de login zeradas"),
  });
  const revogarSessoes = useMutation({
    mutationFn: (id: number) => api.admin.usuarios.revogarSessoes(id),
    ...mutationOpts("Sessões encerradas — usuário precisará fazer login novamente"),
  });
  const promover = useMutation({
    mutationFn: (id: number) => api.admin.usuarios.promover(id),
    ...mutationOpts("Usuário promovido a administrador"),
  });
  const rebaixar = useMutation({
    mutationFn: (id: number) => api.admin.usuarios.rebaixar(id),
    ...mutationOpts("Permissão de admin removida"),
  });
  const estenderAcesso = useMutation({
    mutationFn: ({ id, dias }: { id: number; dias: number }) =>
      api.admin.usuarios.estenderAcesso(id, dias),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "usuarios"] });
      toast.success(`Acesso estendido! Novo prazo: ${formatDate(data.novaExpiracao)}`);
      setExtendTarget(null);
      setExtendDias(30);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isSelf = (u: AdminUsuario) => u.id === currentUser?.id;

  const confirm = (
    label: string,
    description: string,
    onConfirm: () => void,
    variant: "destructive" | "default" = "default"
  ) => setConfirmAction({ label, description, onConfirm, variant });

  // ── Computed stats ─────────────────────────────────────
  const admins = usuarios?.filter((u) => u.role === "Admin").length ?? 0;
  const novos7d = useMemo(() => {
    if (!usuarios) return 0;
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return usuarios.filter((u) => new Date(u.criadoEm) >= cutoff).length;
  }, [usuarios]);

  // ── Search + pagination ────────────────────────────────
  const filtered = useMemo(() => {
    if (!usuarios) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) =>
        u.nome.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        String(u.id).includes(q)
    );
  }, [usuarios, searchQuery]);

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
          <h1 className="text-2xl font-bold">Gerenciamento de Usuários</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visualize e gerencie todas as contas da plataforma
          </p>
        </div>
        <CardSkeleton count={4} />
      </PageShell>
    );
  }

  if (isError) {
    return (
      <PageShell>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Gerenciamento de Usuários</h1>
        </div>
        <ErrorState
          message={error?.message}
          onRetry={() => queryClient.invalidateQueries({ queryKey: ["admin", "usuarios"] })}
        />
      </PageShell>
    );
  }

  const total = usuarios?.length ?? 0;
  const startItem = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <PageShell>
      {/* Title */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold">Gerenciamento de Usuários</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualize e gerencie todas as contas da plataforma
        </p>
      </motion.div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-7">
        {(
          [
            {
              label: "Total de Usuários",
              value: total,
              icon: Users,
              color: "text-emerald-500",
              bg: "bg-emerald-500/10",
              gradient: "from-emerald-500/5",
            },
            {
              label: "Administradores",
              value: admins,
              icon: Crown,
              color: "text-purple-400",
              bg: "bg-purple-500/10",
              gradient: "from-purple-500/5",
            },
            {
              label: "Novos (últimos 7 dias)",
              value: novos7d,
              icon: UserPlus,
              color: "text-sky-400",
              bg: "bg-sky-500/10",
              gradient: "from-sky-400/5",
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
                dados reais
              </span>
              <span className="text-muted-foreground text-xs">da plataforma</span>
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
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Buscar por nome, email ou ID..."
              className="pl-9 pr-3 h-9 text-sm rounded-lg w-full sm:w-64 bg-muted/40 border-border/60 focus:bg-background focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-lg h-9 text-xs">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtros
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-lg h-9 text-xs">
            <Download className="h-3.5 w-3.5" />
            Exportar
          </Button>
        </div>
        <p className="text-sm text-muted-foreground whitespace-nowrap">
          {filtered.length === 0
            ? "Nenhum resultado"
            : `Exibindo ${startItem}–${endItem} de ${filtered.length}`}
          {searchQuery && filtered.length !== total && ` (filtrado de ${total})`}
        </p>
      </motion.div>

      {/* ── Table ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, ease: [0.22, 1, 0.36, 1] as const }}
        className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-275">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                <th className="px-4 py-3.5 min-w-55">Nome / Usuário</th>
                <th className="px-4 py-3.5 min-w-50">Email</th>
                <th className="px-4 py-3.5 min-w-22.5">Role</th>
                <th className="px-4 py-3.5 min-w-27.5">Status</th>
                <th className="px-4 py-3.5 min-w-50">Data de Cadastro</th>
                <th className="px-4 py-3.5 text-right min-w-30">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              <AnimatePresence>
                {paginated.map((u, i) => (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 6 }}
                    transition={{ delay: i * 0.025 }}
                    className={cn(
                      "group transition-colors hover:bg-emerald-500/3",
                      !u.ativo && "opacity-60"
                    )}
                  >
                    {/* Nome */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-xs",
                            getAvatarColor(u.id)
                          )}
                        >
                          {getInitials(u.nome)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold leading-tight">{maskNome(u.nome)}</p>
                            {isSelf(u) && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                                Você
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">#{u.id}</p>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-4">
                      <p className="text-sm text-muted-foreground font-mono">{maskEmail(u.email)}</p>
                      {u.telegramVinculado && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-sky-500 mt-0.5">
                          <Send className="h-2.5 w-2.5" />
                          Telegram
                        </span>
                      )}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-4">{getRoleBadge(u.role)}</td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      {getStatusBadge(u)}
                      {u.tentativasLoginFalhadas > 0 && (
                        <p className="text-[10px] text-amber-500 mt-1">
                          {u.tentativasLoginFalhadas}× senha errada
                        </p>
                      )}
                    </td>

                    {/* Cadastro */}
                    <td className="px-4 py-4">
                      <p className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(u.criadoEm)}
                      </p>
                      {u.acessoExpiraEm && (
                        <p
                          className={cn(
                            "text-xs mt-0.5 flex items-center gap-1 whitespace-nowrap",
                            new Date(u.acessoExpiraEm) < new Date()
                              ? "text-red-500"
                              : "text-muted-foreground/60"
                          )}
                        >
                          <CalendarClock className="h-3 w-3" />
                          {new Date(u.acessoExpiraEm) < new Date() ? "Expirou " : "Expira "}
                          {formatDate(u.acessoExpiraEm)}
                        </p>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-lg text-muted-foreground/60 hover:text-foreground"
                          onClick={() => setSelectedUser(u)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {!isSelf(u) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-lg text-muted-foreground/60 hover:text-foreground"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-64 rounded-xl p-1.5 shadow-lg border border-border/80"
                            >
                              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold px-2 pb-0.5 pt-1">
                                Permissão
                              </DropdownMenuLabel>
                              {u.role === "Admin" ? (
                                <DropdownMenuItem
                                  className="gap-2.5 rounded-lg text-amber-600 dark:text-amber-500 focus:text-amber-600 dark:focus:text-amber-500 cursor-pointer"
                                  onClick={() =>
                                    confirm(
                                      `Remover admin de ${u.nome}?`,
                                      "O usuário perderá acesso ao painel administrativo e voltará a ser um usuário comum.",
                                      () => rebaixar.mutate(u.id)
                                    )
                                  }
                                >
                                  <ShieldOff className="h-4 w-4" />
                                  Remover permissão de Admin
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="gap-2.5 rounded-lg cursor-pointer"
                                  onClick={() =>
                                    confirm(
                                      `Tornar ${u.nome} administrador?`,
                                      "O usuário passará a ter acesso completo ao painel de administração.",
                                      () => promover.mutate(u.id)
                                    )
                                  }
                                >
                                  <Crown className="h-4 w-4" />
                                  Tornar Administrador
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator className="my-1" />

                              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold px-2 pb-0.5 pt-1">
                                Acesso
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                className="gap-2.5 rounded-lg text-emerald-600 dark:text-emerald-500 focus:text-emerald-600 dark:focus:text-emerald-500 cursor-pointer"
                                onClick={() => {
                                  setExtendTarget(u);
                                  setExtendDias(30);
                                }}
                              >
                                <ShieldCheck className="h-4 w-4" />
                                Estender Acesso
                                {u.acessoExpiraEm && new Date(u.acessoExpiraEm) < new Date() && (
                                  <span className="ml-auto text-[10px] text-red-500 font-semibold">
                                    expirado
                                  </span>
                                )}
                              </DropdownMenuItem>

                              <DropdownMenuSeparator className="my-1" />

                              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold px-2 pb-0.5 pt-1">
                                Conta
                              </DropdownMenuLabel>
                              {u.ativo ? (
                                <DropdownMenuItem
                                  className="gap-2.5 rounded-lg text-muted-foreground cursor-pointer"
                                  onClick={() =>
                                    confirm(
                                      `Desativar a conta de ${u.nome}?`,
                                      "A conta será desabilitada. O usuário não conseguirá fazer login até ser reativado manualmente por um admin.",
                                      () => desativar.mutate(u.id),
                                      "destructive"
                                    )
                                  }
                                >
                                  <UserX className="h-4 w-4" />
                                  Desativar conta
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="gap-2.5 rounded-lg text-emerald-600 dark:text-emerald-500 cursor-pointer"
                                  onClick={() => desativar.mutate(u.id)}
                                >
                                  <UserCheck className="h-4 w-4" />
                                  Reativar conta
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator className="my-1" />

                              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold px-2 pb-0.5 pt-1">
                                Segurança
                              </DropdownMenuLabel>

                              {isBloqueado(u) && (
                                <DropdownMenuItem
                                  className="gap-2.5 rounded-lg text-emerald-600 dark:text-emerald-500 cursor-pointer"
                                  onClick={() => desbloquear.mutate(u.id)}
                                >
                                  <Unlock className="h-4 w-4" />
                                  Desbloquear
                                </DropdownMenuItem>
                              )}

                              {!isBloqueado(u) && u.role !== "Admin" && (
                                <DropdownMenuItem
                                  className="gap-2.5 rounded-lg cursor-pointer"
                                  onClick={() =>
                                    confirm(
                                      `Bloquear ${u.nome} temporariamente?`,
                                      "O usuário ficará impedido de fazer login por um período. Use para casos de atividade suspeita.",
                                      () => bloquear.mutate(u.id),
                                      "destructive"
                                    )
                                  }
                                >
                                  <Ban className="h-4 w-4" />
                                  Bloquear temporariamente
                                </DropdownMenuItem>
                              )}

                              {u.tentativasLoginFalhadas > 0 && (
                                <DropdownMenuItem
                                  className="gap-2.5 rounded-lg text-amber-600 dark:text-amber-500 cursor-pointer"
                                  onClick={() => resetarLogin.mutate(u.id)}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  Zerar tentativas erradas ({u.tentativasLoginFalhadas}×)
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuItem
                                className="gap-2.5 rounded-lg text-emerald-600 dark:text-emerald-500 focus:text-emerald-600 dark:focus:text-emerald-500 cursor-pointer"
                                onClick={() =>
                                  confirm(
                                    `Encerrar sessões de ${u.nome}?`,
                                    "O usuário será deslogado de todos os dispositivos e precisará fazer login novamente.",
                                    () => revogarSessoes.mutate(u.id)
                                  )
                                }
                              >
                                <LogOut className="h-4 w-4" />
                                Encerrar sessões (deslogar)
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>

              {paginated.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center">
                    <Users className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery
                        ? "Nenhum usuário corresponde à busca."
                        : "Nenhum usuário encontrado."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {filtered.length > 0 && (
          <div className="border-t border-border/40 px-4 py-4 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground hidden sm:block">
              Mostrando <span className="font-semibold text-foreground">{startItem}</span>
              {" – "}
              <span className="font-semibold text-foreground">{endItem}</span>
              {" de "}
              <span className="font-semibold text-foreground">{filtered.length}</span>
              {" resultados"}
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

      {/* ── Dialogs ── */}
      <UserDetailDialog usuario={selectedUser} onClose={() => setSelectedUser(null)} />

      <ExtenderAcessoDialog
        usuario={extendTarget}
        dias={extendDias}
        onDiasChange={setExtendDias}
        isPending={estenderAcesso.isPending}
        onConfirm={() =>
          extendTarget && estenderAcesso.mutate({ id: extendTarget.id, dias: extendDias })
        }
        onClose={() => {
          setExtendTarget(null);
          setExtendDias(30);
        }}
      />

      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.label}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmAction?.onConfirm();
                setConfirmAction(null);
              }}
              className={cn(
                confirmAction?.variant === "destructive" &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

// ── UserDetailDialog ───────────────────────────────────────

function UserDetailDialog({
  usuario,
  onClose,
}: {
  usuario: AdminUsuario | null;
  onClose: () => void;
}) {
  const { data: detalhe, isLoading } = useQuery({
    queryKey: ["admin", "usuarios", usuario?.id],
    queryFn: () => api.admin.usuarios.detalhe(usuario!.id),
    enabled: !!usuario,
  });

  const u = detalhe ?? usuario;

  return (
    <Dialog open={!!usuario} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-md max-h-[90vh] overflow-y-auto p-0 gap-0"
      >
        {/* Header */}
        <div className="relative bg-linear-to-br from-emerald-600/10 via-emerald-500/5 to-transparent border-b border-border/40 px-6 pt-12 pb-5">
          <DialogTitle className="sr-only">Perfil de {u?.nome}</DialogTitle>
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "h-14 w-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-lg",
                u ? getAvatarColor(u.id) : "bg-muted"
              )}
            >
              {u ? getInitials(u.nome) : "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-foreground">{u?.nome ?? usuario?.nome}</h2>
                {u && getRoleBadge(u.role)}
              </div>
              <p className="text-[13px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1.5">
                <Mail className="h-3 w-3 shrink-0" />
                {u?.email ?? usuario?.email}
              </p>
              <div className="mt-2">{u && getStatusBadge(u)}</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4 pb-10">
            {isLoading && !detalhe ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: "Lançamentos",
                      value: u?.totalLancamentos ?? 0,
                      Icon: TrendingUp,
                      color: "bg-emerald-500/10 text-emerald-600",
                    },
                    {
                      label: "Cartões",
                      value: u?.totalCartoes ?? 0,
                      Icon: CreditCard,
                      color: "bg-blue-500/10 text-blue-600",
                    },
                    {
                      label: "Metas",
                      value: u?.totalMetas ?? 0,
                      Icon: Target,
                      color: "bg-violet-500/10 text-violet-600",
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-xl border border-border/40 bg-muted/20 p-3 flex flex-col items-center gap-1.5"
                    >
                      <div
                        className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center",
                          s.color
                        )}
                      >
                        <s.Icon className="h-4 w-4" />
                      </div>
                      <p className="text-xl font-bold tabular-nums">{s.value}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Info rows */}
                <div className="rounded-xl border border-border/40 overflow-hidden">
                  {[
                    { label: "Membro desde", value: formatDate(u?.criadoEm ?? "") },
                    {
                      label: "Sessões ativas",
                      value: (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 font-semibold",
                            (detalhe?.sessoesAtivas ?? 0) > 0
                              ? "text-emerald-600"
                              : "text-muted-foreground"
                          )}
                        >
                          <Shield className="h-3.5 w-3.5" />
                          {detalhe?.sessoesAtivas ?? 0}
                        </span>
                      ),
                    },
                    {
                      label: "Telegram",
                      value: u?.telegramVinculado ? (
                        <span className="inline-flex items-center gap-1 text-sky-500 font-semibold">
                          <Send className="h-3.5 w-3.5" /> Vinculado
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Não vinculado</span>
                      ),
                    },
                    {
                      label: "Tentativas de login falhadas",
                      value: (
                        <span
                          className={cn(
                            "font-semibold",
                            (u?.tentativasLoginFalhadas ?? 0) > 0
                              ? "text-amber-500"
                              : "text-muted-foreground"
                          )}
                        >
                          {u?.tentativasLoginFalhadas ?? 0}×
                        </span>
                      ),
                    },
                    ...(u?.acessoExpiraEm
                      ? [
                        {
                          label: "Acesso expira em",
                          value: (
                            <span
                              className={cn(
                                "font-semibold text-sm",
                                new Date(u.acessoExpiraEm) < new Date()
                                  ? "text-red-500"
                                  : "text-amber-500"
                              )}
                            >
                              {formatDate(u.acessoExpiraEm)}
                            </span>
                          ),
                        },
                      ]
                      : []),
                  ].map((row, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center justify-between px-4 py-3 text-sm",
                        i > 0 && "border-t border-border/40"
                      )}
                    >
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
                        {row.label}
                      </span>
                      <span className="text-sm font-semibold">{row.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-border/40 px-6 py-4 flex justify-end bg-muted/10 mt-auto">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── ExtenderAcessoDialog ───────────────────────────────────

const PRESETS_EXTEND = [
  { label: "7 dias", value: 7 },
  { label: "15 dias", value: 15 },
  { label: "30 dias", value: 30 },
  { label: "90 dias", value: 90 },
  { label: "6 meses", value: 180 },
  { label: "1 ano", value: 365 },
];

function ExtenderAcessoDialog({
  usuario,
  dias,
  onDiasChange,
  isPending,
  onConfirm,
  onClose,
}: {
  usuario: AdminUsuario | null;
  dias: number;
  onDiasChange: (v: number) => void;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const agora = new Date();
  const expiraAtual = usuario?.acessoExpiraEm ? new Date(usuario.acessoExpiraEm) : null;
  const estaExpirado = expiraAtual !== null && expiraAtual < agora;
  const baseData = expiraAtual && !estaExpirado ? expiraAtual : agora;
  const novaExpiracao = new Date(baseData.getTime() + dias * 86400_000);

  return (
    <Dialog open={!!usuario} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-md max-h-[90vh] overflow-y-auto p-0 gap-0"
      >
        <DialogHeader className="px-6 py-5 border-b border-border/40 pt-12">
          <DialogTitle className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            Estender Acesso
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-4 py-6">
            <div className="rounded-xl border border-border/40 bg-muted/30 p-3 space-y-1">
              <p className="font-semibold text-sm">{usuario?.nome}</p>
              <p className="text-[11px] text-muted-foreground/60">{usuario?.email}</p>
              <div className="flex items-center gap-1.5 text-[11px] mt-1">
                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground/50" />
                {expiraAtual ? (
                  <span
                    className={cn(
                      estaExpirado ? "text-red-500 font-semibold" : "text-muted-foreground/70"
                    )}
                  >
                    Acesso atual: {estaExpirado ? "expirou em" : "expira em"}{" "}
                    {formatDate(usuario!.acessoExpiraEm!)}
                  </span>
                ) : (
                  <span className="text-emerald-600 font-semibold">
                    Acesso permanente (sem prazo definido)
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground/70 uppercase tracking-wider">
                Dias a adicionar
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS_EXTEND.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => onDiasChange(p.value)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all",
                      dias === p.value
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  value={dias}
                  onChange={(e) =>
                    onDiasChange(Math.max(1, Math.min(3650, Number(e.target.value))))
                  }
                  className="h-9 rounded-lg w-24 text-center font-semibold tabular-nums"
                />
                <span className="text-sm text-muted-foreground">dias</span>
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <p className="text-[11px] text-muted-foreground/60 mb-0.5">Nova data de expiração</p>
              <p className="font-bold text-primary">
                {novaExpiracao.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              {estaExpirado && (
                <p className="text-[11px] text-amber-600 mt-1">
                  Como o acesso já expirou, os dias serão contados a partir de hoje.
                </p>
              )}
              {expiraAtual === null && (
                <p className="text-[11px] text-amber-600 mt-1">
                  O usuário tem acesso permanente. Após estender, passará a ter prazo definido.
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/40 bg-muted/10 flex-col sm:flex-row gap-2 sm:justify-end mt-auto">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={dias < 1}
            loading={isPending}
            className="gap-2 rounded-xl font-bold"
          >
            <ShieldCheck className="h-4 w-4" />
            Estender Acesso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
