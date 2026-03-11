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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { ErrorState } from "@/components/shared/page-components";
import { DialogShellHeader } from "@/components/shared/dialog-shell";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// ── Helpers ────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-slate-100 text-slate-600",
  "bg-indigo-50 text-indigo-600",
  "bg-emerald-50 text-emerald-600",
  "bg-blue-50 text-blue-600",
  "bg-rose-50 text-rose-600",
  "bg-amber-50 text-amber-600",
  "bg-cyan-50 text-cyan-600",
  "bg-pink-50 text-pink-600",
  "bg-teal-50 text-teal-600",
  "bg-violet-50 text-violet-600",
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
      <span className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-red-50 text-red-600 border border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20">
        Bloqueado
      </span>
    );
  }
  if (!u.ativo) {
    return (
      <span className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20">
        Inativo
      </span>
    );
  }
  if (u.acessoExpiraEm && new Date(u.acessoExpiraEm) < new Date()) {
    return (
      <span className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-yellow-50 text-yellow-600 border border-yellow-100 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20">
        Expirado
      </span>
    );
  }
  return (
    <span className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
      Ativo
    </span>
  );
}

function getRoleBadge(role: string) {
  if (role === "Admin") {
    return (
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
          Administrador
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-500" />
      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Usuário</span>
    </div>
  );
}

function hasTemporaryAccess(u: AdminUsuario) {
  return !!u.acessoExpiraEm;
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
  const [statusFilter, setStatusFilter] = useState<
    "todos" | "ativos" | "inativos" | "bloqueados" | "expirados"
  >("todos");
  const [roleFilter, setRoleFilter] = useState({ admin: true, usuario: true });
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
  const statusCounts = useMemo(() => {
    if (!usuarios) return { todos: 0, ativos: 0, inativos: 0, bloqueados: 0, expirados: 0 };
    const now = new Date();
    return {
      todos: usuarios.length,
      ativos: usuarios.filter(
        (u) => u.ativo && !isBloqueado(u) && !(u.acessoExpiraEm && new Date(u.acessoExpiraEm) < now)
      ).length,
      inativos: usuarios.filter((u) => !u.ativo).length,
      bloqueados: usuarios.filter((u) => isBloqueado(u)).length,
      expirados: usuarios.filter(
        (u) => u.ativo && !isBloqueado(u) && u.acessoExpiraEm && new Date(u.acessoExpiraEm) < now
      ).length,
    };
  }, [usuarios]);

  // ── Search + filters + pagination ──────────────────────
  const filtered = useMemo(() => {
    if (!usuarios) return [];
    let list = [...usuarios];
    const now = new Date();

    if (statusFilter === "ativos")
      list = list.filter(
        (u) => u.ativo && !isBloqueado(u) && !(u.acessoExpiraEm && new Date(u.acessoExpiraEm) < now)
      );
    else if (statusFilter === "inativos") list = list.filter((u) => !u.ativo);
    else if (statusFilter === "bloqueados") list = list.filter((u) => isBloqueado(u));
    else if (statusFilter === "expirados")
      list = list.filter(
        (u) => u.ativo && !isBloqueado(u) && u.acessoExpiraEm && new Date(u.acessoExpiraEm) < now
      );

    if (!roleFilter.admin) list = list.filter((u) => u.role !== "Admin");
    if (!roleFilter.usuario) list = list.filter((u) => u.role !== "User");

    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (u) =>
          u.nome.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          String(u.id).includes(q)
      );
    }
    return list;
  }, [usuarios, searchQuery, statusFilter, roleFilter]);

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

  // ── Loading ────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex gap-4 sm:gap-8 lg:gap-10 h-full">
        <aside className="w-80 shrink-0 hidden lg:block">
          <div className="exec-card p-8 rounded-[2.5rem]">
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-28 mb-8" />
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        </aside>
        <div className="flex-1">
          <div className="exec-card rounded-2xl lg:rounded-[3rem] p-4 sm:p-6 lg:p-10">
            <Skeleton className="h-6 w-56 mb-2" />
            <Skeleton className="h-3 w-32 mb-8" />
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex items-center justify-center h-full">
        <ErrorState
          message={error?.message}
          onRetry={() => queryClient.invalidateQueries({ queryKey: ["admin", "usuarios"] })}
        />
      </div>
    );
  }

  const total = usuarios?.length ?? 0;
  const startItem = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <>
      <div className="flex gap-4 sm:gap-8 lg:gap-10 h-full min-h-0">
        {/* ── Sidebar (desktop) ── */}
        <aside className="w-80 shrink-0 space-y-6 hidden lg:flex flex-col overflow-y-auto hide-scrollbar">
          {/* Filters card */}
          <div className="exec-card p-8 rounded-[2.5rem]">
            <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mb-8">
              Filtros Avançados
            </h3>
            <div className="space-y-6">
              {/* Search */}
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">
                  Pesquisar
                </label>
                <div className="relative">
                  <Input
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Nome, email ou ID..."
                    className="bg-slate-50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-3 text-[11px] placeholder:text-slate-300 focus:ring-1 focus:ring-emerald-500 h-auto"
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                </div>
              </div>

              {/* Status filter */}
              <div className="pt-4 border-t border-slate-50 dark:border-slate-800">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4 block">
                  Status da Conta
                </label>
                <div className="space-y-2">
                  {(
                    [
                      { key: "todos", label: "Todos os Usuários", count: statusCounts.todos },
                      { key: "ativos", label: "Ativos", count: statusCounts.ativos },
                      { key: "inativos", label: "Inativos", count: statusCounts.inativos },
                      { key: "bloqueados", label: "Bloqueados", count: statusCounts.bloqueados },
                      { key: "expirados", label: "Expirados", count: statusCounts.expirados },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.key}
                      onClick={() => {
                        setStatusFilter(f.key);
                        setCurrentPage(1);
                      }}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl border border-transparent hover:border-slate-100 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer w-full text-left",
                        statusFilter === f.key &&
                          "border-emerald-50 bg-emerald-50/30 dark:border-emerald-500/20 dark:bg-emerald-500/5"
                      )}
                    >
                      <span
                        className={cn(
                          "text-[11px]",
                          statusFilter === f.key
                            ? "font-bold text-emerald-600 dark:text-emerald-400"
                            : "font-medium text-slate-600 dark:text-slate-300"
                        )}
                      >
                        {f.label}
                      </span>
                      <span
                        className={cn(
                          "text-[9px] mono-data px-2 py-0.5 rounded",
                          statusFilter === f.key
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                        )}
                      >
                        {String(f.count).padStart(2, "0")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Role filter */}
              <div className="pt-4 border-t border-slate-50 dark:border-slate-800">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4 block">
                  Nível de Acesso
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 px-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={roleFilter.admin}
                      onChange={(e) => {
                        setRoleFilter((r) => ({ ...r, admin: e.target.checked }));
                        setCurrentPage(1);
                      }}
                      className="rounded border-slate-200 dark:border-slate-600 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-[11px] text-slate-600 dark:text-slate-300">
                      Administradores
                    </span>
                  </label>
                  <label className="flex items-center gap-3 px-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={roleFilter.usuario}
                      onChange={(e) => {
                        setRoleFilter((r) => ({ ...r, usuario: e.target.checked }));
                        setCurrentPage(1);
                      }}
                      className="rounded border-slate-200 dark:border-slate-600 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-[11px] text-slate-600 dark:text-slate-300">Usuários</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Export card */}
          <div className="exec-card p-8 rounded-[2.5rem] bg-emerald-50/20! dark:bg-emerald-500/5! border-emerald-100! dark:border-emerald-500/20!">
            <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-[0.2em] mb-4">
              Exportação
            </p>
            <p className="text-[11px] text-emerald-800/60 dark:text-emerald-400/60 leading-relaxed mb-6">
              Gere relatórios de auditoria e logs de acesso detalhados.
            </p>
            <Button
              variant="outline"
              className="w-full py-3 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all"
            >
              <Download className="h-3.5 w-3.5 mr-2" />
              Download CSV
            </Button>
          </div>
        </aside>

        {/* ── Content ── */}
        <section className="flex-1 flex flex-col min-h-0">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="exec-card rounded-2xl lg:rounded-[3rem] flex-1 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 lg:p-10 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl serif-italic">Gerenciamento de Usuários</h2>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">
                  {filtered.length} registros encontrados
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Mobile search */}
                <div className="relative lg:hidden">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="pl-9 h-9 text-sm rounded-xl w-40 sm:w-56"
                  />
                </div>
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["admin", "usuarios"] })}
                  className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 transition-all"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto hide-scrollbar">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-10">
                  <tr className="text-left border-b border-slate-50 dark:border-slate-800">
                    <th className="px-6 lg:px-10 py-5 text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                      Usuário
                    </th>
                    <th className="px-4 lg:px-8 py-5 text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] hidden sm:table-cell">
                      Email
                    </th>
                    <th className="px-4 lg:px-8 py-5 text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] hidden md:table-cell">
                      Cargo
                    </th>
                    <th className="px-4 lg:px-8 py-5 text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                      Status
                    </th>
                    <th className="px-4 lg:px-8 py-5 text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] hidden lg:table-cell">
                      Cadastro
                    </th>
                    <th className="px-6 lg:px-10 py-5 text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] text-right">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  <AnimatePresence>
                    {paginated.map((u, i) => (
                      <motion.tr
                        key={u.id}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 4 }}
                        transition={{ delay: i * 0.02 }}
                        className={cn(
                          "hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group",
                          !u.ativo && "opacity-60"
                        )}
                      >
                        {/* User */}
                        <td className="px-6 lg:px-10 py-5 lg:py-6">
                          <div className="flex items-center gap-3 lg:gap-4">
                            <div
                              className={cn(
                                "w-9 h-9 lg:w-10 lg:h-10 rounded-2xl flex items-center justify-center text-[10px] font-bold shrink-0",
                                getAvatarColor(u.id)
                              )}
                            >
                              {getInitials(u.nome)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-[13px] font-semibold truncate">
                                  {maskNome(u.nome)}
                                </p>
                                {isSelf(u) && (
                                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 shrink-0">
                                    Você
                                  </span>
                                )}
                              </div>
                              <p className="text-[9px] text-slate-400 mono-data">#{u.id}</p>
                              {/* Email inline on xs */}
                              <p className="text-[10px] text-slate-400 truncate sm:hidden mt-0.5">
                                {maskEmail(u.email)}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="px-4 lg:px-8 py-5 lg:py-6 hidden sm:table-cell">
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {maskEmail(u.email)}
                          </p>
                          {u.telegramVinculado && (
                            <span className="inline-flex items-center gap-1 text-[9px] text-sky-500 mt-1">
                              <Send className="h-2.5 w-2.5" />
                              Telegram
                            </span>
                          )}
                        </td>

                        {/* Role */}
                        <td className="px-4 lg:px-8 py-5 lg:py-6 hidden md:table-cell">
                          {getRoleBadge(u.role)}
                        </td>

                        {/* Status */}
                        <td className="px-4 lg:px-8 py-5 lg:py-6">
                          {getStatusBadge(u)}
                          {u.tentativasLoginFalhadas > 0 && (
                            <p className="text-[9px] text-amber-500 mt-1 mono-data">
                              {u.tentativasLoginFalhadas}× falha
                            </p>
                          )}
                        </td>

                        {/* Date */}
                        <td className="px-4 lg:px-8 py-5 lg:py-6 hidden lg:table-cell">
                          <p className="text-[11px] mono-data text-slate-500 dark:text-slate-400">
                            {formatDate(u.criadoEm)}
                          </p>
                          {u.acessoExpiraEm && (
                            <p
                              className={cn(
                                "text-[9px] mt-1 flex items-center gap-1 mono-data",
                                new Date(u.acessoExpiraEm) < new Date()
                                  ? "text-red-500"
                                  : "text-slate-400"
                              )}
                            >
                              <CalendarClock className="h-3 w-3" />
                              {new Date(u.acessoExpiraEm) < new Date() ? "Expirou " : "Expira "}
                              {formatDate(u.acessoExpiraEm)}
                            </p>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 lg:px-10 py-5 lg:py-6 text-right">
                          <div className="flex items-center justify-end gap-1 lg:gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setSelectedUser(u)}
                              className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all"
                              title="Ver detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {!isSelf(u) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
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
                                  {hasTemporaryAccess(u) ? (
                                    <DropdownMenuItem
                                      className="gap-2.5 rounded-lg text-emerald-600 dark:text-emerald-500 focus:text-emerald-600 dark:focus:text-emerald-500 cursor-pointer"
                                      onClick={() => {
                                        setExtendTarget(u);
                                        setExtendDias(30);
                                      }}
                                    >
                                      <ShieldCheck className="h-4 w-4" />
                                      Adicionar dias ao prazo
                                      {u.acessoExpiraEm &&
                                        new Date(u.acessoExpiraEm) < new Date() && (
                                          <span className="ml-auto text-[10px] text-red-500 font-semibold">
                                            expirado
                                          </span>
                                        )}
                                    </DropdownMenuItem>
                                  ) : (
                                    <div className="px-2 py-2 text-[11px] text-slate-400">
                                      Acesso permanente ou controlado pelo plano atual.
                                    </div>
                                  )}

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
                      <td colSpan={6} className="px-10 py-20 text-center">
                        <Users className="h-10 w-10 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                        <p className="text-[11px] text-slate-400">
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

            {/* Pagination */}
            {filtered.length > 0 && (
              <div className="p-5 lg:p-8 border-t border-slate-50 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex items-center justify-between">
                <p className="text-[11px] text-slate-400 mono-data hidden sm:block">
                  {startItem}–{endItem} de {filtered.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-2 rounded-lg border border-slate-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-400 disabled:opacity-30 transition-all"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-1">
                    {getPageNumbers().map((p, idx) =>
                      p === "..." ? (
                        <span key={`dots-${idx}`} className="px-2 text-slate-300 text-[11px]">
                          ...
                        </span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p as number)}
                          className={cn(
                            "h-8 w-8 rounded-lg text-[11px] font-bold transition-all",
                            safePage === p
                              ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20"
                              : "text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                          )}
                        >
                          {p}
                        </button>
                      )
                    )}
                  </div>
                  <button
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-2 rounded-lg border border-slate-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-400 disabled:opacity-30 transition-all"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </section>
      </div>

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
          <AlertDialogHeader className="items-start text-left">
            <AlertDialogTitle className="sr-only">{confirmAction?.label}</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              {confirmAction?.description}
            </AlertDialogDescription>
            <DialogShellHeader
              icon={
                confirmAction?.variant === "destructive" ? (
                  <ShieldOff className="h-5 w-5 sm:h-6 sm:w-6" />
                ) : (
                  <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
                )
              }
              title={confirmAction?.label ?? "Confirmar ação"}
              description={confirmAction?.description ?? "Revise a ação antes de continuar."}
              tone={confirmAction?.variant === "destructive" ? "rose" : "amber"}
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmAction?.onConfirm();
                setConfirmAction(null);
              }}
              className={cn(
                "rounded-xl",
                confirmAction?.variant === "destructive" &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="relative bg-linear-to-br from-emerald-600/10 via-emerald-500/5 to-transparent border-b border-border/40 px-5 sm:px-6 pt-8 sm:pt-12 pb-5">
          <DialogTitle className="sr-only">Perfil de {u?.nome}</DialogTitle>
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "h-14 w-14 rounded-2xl flex items-center justify-center font-bold text-xl shrink-0 shadow-lg",
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
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
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
                    {
                      label: "Membro desde",
                      value: formatDate(u?.criadoEm ?? ""),
                    },
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 py-5 border-b border-border/40 pt-12">
          <DialogTitle className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            Ajustar prazo de acesso
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
                    Prazo atual: {estaExpirado ? "expirou em" : "expira em"}{" "}
                    {formatDate(usuario!.acessoExpiraEm!)}
                  </span>
                ) : (
                  <span className="text-muted-foreground/70">Sem prazo temporário configurado</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground/70 uppercase tracking-wider">
                Dias a acrescentar
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
                  Como o prazo já expirou, os dias serão contados a partir de hoje.
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
            Salvar novo prazo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
