"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type AdminUsuario } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { formatDate, formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
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
  Sparkles,
  Send,
  Activity,
  CalendarClock,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
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
import { PageShell, PageHeader, ErrorState, CardSkeleton } from "@/components/shared/page-components";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";



export default function AdminUsuariosPage() {
  const queryClient = useQueryClient();
  const { usuario: currentUser } = useAuth();
  const [selectedUser, setSelectedUser] = useState<AdminUsuario | null>(null);
  const [extendTarget, setExtendTarget] = useState<AdminUsuario | null>(null);
  const [extendDias, setExtendDias] = useState(30);
  const [confirmAction, setConfirmAction] = useState<{
    label: string;
    description: string;
    variant?: "destructive" | "default";
    onConfirm: () => void;
  } | null>(null);

  const { data: usuarios, isLoading, isError, error } = useQuery({
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

  const bloquear = useMutation({ mutationFn: (id: number) => api.admin.usuarios.bloquear(id), ...mutationOpts("Usuário bloqueado") });
  const desbloquear = useMutation({ mutationFn: (id: number) => api.admin.usuarios.desbloquear(id), ...mutationOpts("Usuário desbloqueado") });
  const desativar = useMutation({ mutationFn: (id: number) => api.admin.usuarios.desativar(id), ...mutationOpts("Status da conta alterado") });
  const resetarLogin = useMutation({ mutationFn: (id: number) => api.admin.usuarios.resetarLogin(id), ...mutationOpts("Tentativas de login zeradas") });
  const revogarSessoes = useMutation({ mutationFn: (id: number) => api.admin.usuarios.revogarSessoes(id), ...mutationOpts("Sessões encerradas — usuário precisará fazer login novamente") });
  const promover = useMutation({ mutationFn: (id: number) => api.admin.usuarios.promover(id), ...mutationOpts("Usuário promovido a administrador") });
  const rebaixar = useMutation({ mutationFn: (id: number) => api.admin.usuarios.rebaixar(id), ...mutationOpts("Permissão de admin removida") });
  const estenderAcesso = useMutation({
    mutationFn: ({ id, dias }: { id: number; dias: number }) => api.admin.usuarios.estenderAcesso(id, dias),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "usuarios"] });
      toast.success(`Acesso estendido! Novo prazo: ${formatDate(data.novaExpiracao)}`);
      setExtendTarget(null);
      setExtendDias(30);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isSelf = (u: AdminUsuario) => u.id === currentUser?.id;
  const isBloqueado = (u: AdminUsuario) => !!u.bloqueadoAte && new Date(u.bloqueadoAte) > new Date();

  const confirm = (label: string, description: string, onConfirm: () => void, variant: "destructive" | "default" = "default") =>
    setConfirmAction({ label, description, onConfirm, variant });

  if (isLoading) {
    return (
      <PageShell>
        <PageHeader title="Usuários" description="Gerencie os usuários do sistema" />
        <CardSkeleton count={4} />
      </PageShell>
    );
  }

  if (isError) {
    return (
      <PageShell>
        <PageHeader title="Usuários" description="Gerencie os usuários do sistema" />
        <ErrorState message={error?.message} onRetry={() => queryClient.invalidateQueries({ queryKey: ["admin", "usuarios"] })} />
      </PageShell>
    );
  }

  const admins = usuarios?.filter((u) => u.role === "Admin").length ?? 0;
  const bloqueados = usuarios?.filter((u) => isBloqueado(u)).length ?? 0;
  const inativos = usuarios?.filter((u) => !u.ativo).length ?? 0;

  return (
    <PageShell>
      <PageHeader title="Usuários" description="Gerencie as contas e permissões de cada usuário">
      </PageHeader>

      {/* Summary */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {[
          { label: "Total", value: usuarios?.length ?? 0, color: "text-foreground", bg: "bg-muted/60", icon: Users },
          { label: "Administradores", value: admins, color: "text-amber-500", bg: "bg-amber-500/10", icon: Crown },
          { label: "Inativos", value: inativos, color: "text-muted-foreground", bg: "bg-muted/60", icon: UserX },
          { label: "Bloqueados", value: bloqueados, color: "text-red-500", bg: "bg-red-500/10", icon: Ban },
        ].map((item) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-premium p-4 flex items-center gap-3"
          >
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", item.bg)}>
              <item.icon className={cn("h-4 w-4", item.color)} />
            </div>
            <div>
              <p className={cn("text-2xl font-extrabold tabular-nums", item.color)}>{item.value}</p>
              <p className="text-[11px] text-muted-foreground/60 font-medium">{item.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground/60 px-0.5">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Admin — pode acessar este painel</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />Bloqueado — muitas tentativas erradas de senha (temporário)</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground/40" />Inativo — conta desabilitada manualmente</span>
      </div>

      {/* User List */}
      <div className="space-y-2.5">
        <AnimatePresence mode="popLayout">
          {usuarios?.map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.03 }}
              className={cn(
                "card-premium p-4 group",
                !u.ativo && "opacity-60",
                isSelf(u) && "border-primary/30"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Name + badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm">{u.nome}</p>
                    {isSelf(u) && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">Você</Badge>
                    )}
                    {u.role === "Admin" && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-500 border-amber-500/20">
                        <Crown className="h-2.5 w-2.5 mr-1" />Admin
                      </Badge>
                    )}
                    {!u.ativo && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground border-border/30">Inativo</Badge>
                    )}
                    {isBloqueado(u) && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-red-500/10 text-red-500 border-red-500/20">
                        <Ban className="h-2.5 w-2.5 mr-1" />Bloqueado
                      </Badge>
                    )}
                    {u.telegramVinculado && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-sky-500/10 text-sky-500 border-sky-500/20">
                        <Send className="h-2.5 w-2.5 mr-1" />Telegram
                      </Badge>
                    )}
                    {u.acessoExpiraEm && new Date(u.acessoExpiraEm) < new Date() && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-red-500/10 text-red-500 border-red-500/20">
                        <Clock className="h-2.5 w-2.5 mr-1" />Acesso expirado
                      </Badge>
                    )}
                    {u.acessoExpiraEm && new Date(u.acessoExpiraEm) >= new Date() &&
                      (new Date(u.acessoExpiraEm).getTime() - Date.now()) < 7 * 86400_000 && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-500 border-amber-500/20">
                          <Clock className="h-2.5 w-2.5 mr-1" />Acesso expira em breve
                        </Badge>
                      )}
                  </div>

                  {/* Email */}
                  <p className="text-xs text-muted-foreground/60">{u.email}</p>

                  {/* Stats */}
                  <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground/50 font-medium">
                    <span>Desde {formatDate(u.criadoEm)}</span>
                    <span>·</span>
                    <span>{u.totalLancamentos} lançamentos</span>
                    <span>·</span>
                    <span>{u.totalCartoes} cartões</span>
                    <span>·</span>
                    <span>{u.totalMetas} metas</span>
                    {u.tentativasLoginFalhadas > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-amber-500">{u.tentativasLoginFalhadas}x senha errada</span>
                      </>
                    )}
                    {u.bloqueadoAte && isBloqueado(u) && (
                      <>
                        <span>·</span>
                        <span className="text-red-500">desbloqueio em {formatDate(u.bloqueadoAte)}</span>
                      </>
                    )}
                    {u.acessoExpiraEm && (
                      <>
                        <span>·</span>
                        <span className={cn(
                          "flex items-center gap-1",
                          new Date(u.acessoExpiraEm) < new Date() ? "text-red-500" : "text-primary/70"
                        )}>
                          <CalendarClock className="h-3 w-3" />
                          {new Date(u.acessoExpiraEm) < new Date() ? "Acesso expirou em" : "Acesso até"} {formatDate(u.acessoExpiraEm)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs rounded-lg gap-1.5"
                    onClick={() => setSelectedUser(u)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Ver</span>
                  </Button>

                  {!isSelf(u) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg text-muted-foreground/60 hover:text-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">

                        {/* Permissão */}
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-bold pb-1">
                          Permissão
                        </DropdownMenuLabel>
                        {u.role === "Admin" ? (
                          <DropdownMenuItem
                            className="gap-2 text-amber-600"
                            onClick={() => confirm(
                              `Remover admin de ${u.nome}?`,
                              "O usuário perderá acesso ao painel administrativo e voltará a ser um usuário comum.",
                              () => rebaixar.mutate(u.id)
                            )}
                          >
                            <ShieldOff className="h-4 w-4" />
                            Remover permissão de Admin
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            className="gap-2 text-violet-600"
                            onClick={() => confirm(
                              `Tornar ${u.nome} administrador?`,
                              "O usuário passará a ter acesso completo ao painel de administração.",
                              () => promover.mutate(u.id)
                            )}
                          >
                            <Crown className="h-4 w-4" />
                            Tornar Administrador
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />

                        {/* Acesso */}
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-bold pb-1">
                          Acesso
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          className="gap-2 text-primary"
                          onClick={() => { setExtendTarget(u); setExtendDias(30); }}
                        >
                          <ShieldCheck className="h-4 w-4" />
                          Estender Acesso
                          {u.acessoExpiraEm && new Date(u.acessoExpiraEm) < new Date() && (
                            <span className="ml-auto text-[10px] text-red-500 font-semibold">expirado</span>
                          )}
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {/* Conta */}
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-bold pb-1">
                          Conta
                        </DropdownMenuLabel>
                        {u.ativo ? (
                          <DropdownMenuItem
                            className="gap-2 text-muted-foreground"
                            onClick={() => confirm(
                              `Desativar a conta de ${u.nome}?`,
                              "A conta será desabilitada. O usuário não conseguirá fazer login até ser reativado manualmente por um admin.",
                              () => desativar.mutate(u.id),
                              "destructive"
                            )}
                          >
                            <UserX className="h-4 w-4" />
                            Desativar conta
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            className="gap-2 text-emerald-600"
                            onClick={() => desativar.mutate(u.id)}
                          >
                            <UserCheck className="h-4 w-4" />
                            Reativar conta
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />

                        {/* Segurança */}
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-bold pb-1">
                          Segurança
                        </DropdownMenuLabel>

                        {isBloqueado(u) && (
                          <DropdownMenuItem
                            className="gap-2 text-emerald-600"
                            onClick={() => desbloquear.mutate(u.id)}
                          >
                            <Unlock className="h-4 w-4" />
                            Desbloquear (remover bloqueio)
                          </DropdownMenuItem>
                        )}

                        {!isBloqueado(u) && u.role !== "Admin" && (
                          <DropdownMenuItem
                            className="gap-2 text-red-600"
                            onClick={() => confirm(
                              `Bloquear ${u.nome} temporariamente?`,
                              "O usuário ficará impedido de fazer login por um período. Use para casos de atividade suspeita.",
                              () => bloquear.mutate(u.id),
                              "destructive"
                            )}
                          >
                            <Ban className="h-4 w-4" />
                            Bloquear temporariamente
                          </DropdownMenuItem>
                        )}

                        {u.tentativasLoginFalhadas > 0 && (
                          <DropdownMenuItem
                            className="gap-2 text-amber-600"
                            onClick={() => resetarLogin.mutate(u.id)}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Zerar tentativas erradas ({u.tentativasLoginFalhadas}x)
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuItem
                          className="gap-2 text-orange-600"
                          onClick={() => confirm(
                            `Encerrar sessões de ${u.nome}?`,
                            "O usuário será deslogado de todos os dispositivos e precisará fazer login novamente.",
                            () => revogarSessoes.mutate(u.id)
                          )}
                        >
                          <LogOut className="h-4 w-4" />
                          Encerrar sessões (deslogar)
                        </DropdownMenuItem>

                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {(!usuarios || usuarios.length === 0) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card-premium p-10 flex flex-col items-center justify-center text-center"
          >
            <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Nenhum usuário encontrado.</p>
          </motion.div>
        )}
      </div>

      {/* Detail Dialog */}
      <UserDetailDialog usuario={selectedUser} onClose={() => setSelectedUser(null)} />

      {/* Extend Access Dialog */}
      <ExtenderAcessoDialog
        usuario={extendTarget}
        dias={extendDias}
        onDiasChange={setExtendDias}
        isPending={estenderAcesso.isPending}
        onConfirm={() => extendTarget && estenderAcesso.mutate({ id: extendTarget.id, dias: extendDias })}
        onClose={() => { setExtendTarget(null); setExtendDias(30); }}
      />

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.label}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { confirmAction?.onConfirm(); setConfirmAction(null); }}
              className={cn(confirmAction?.variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

function UserDetailDialog({ usuario, onClose }: { usuario: AdminUsuario | null; onClose: () => void }) {
  const { data: detalhe, isLoading } = useQuery({
    queryKey: ["admin", "usuarios", usuario?.id],
    queryFn: () => api.admin.usuarios.detalhe(usuario!.id),
    enabled: !!usuario,
  });

  return (
    <Dialog open={!!usuario} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Activity className="h-4.5 w-4.5" />
            </div>
            Perfil de {usuario?.nome}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
          </div>
        ) : detalhe ? (
          <div className="space-y-5">
            {/* Basic info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                { label: "Nome", value: detalhe.nome },
                { label: "Email", value: detalhe.email },
                { label: "Membro desde", value: formatDate(detalhe.criadoEm) },
                { label: "Papel", value: detalhe.role },
                { label: "Sessões abertas agora", value: detalhe.sessoesAtivas },
                { label: "Telegram", value: detalhe.telegramVinculado ? "Vinculado ✓" : "Não vinculado" },
              ].map((row) => (
                <div key={row.label} className="space-y-0.5">
                  <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">{row.label}</p>
                  <p className="font-semibold">{row.value}</p>
                </div>
              ))}
            </div>

          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            Estender Acesso
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* User info */}
          <div className="rounded-xl border border-border/40 bg-muted/30 p-3 space-y-1">
            <p className="font-semibold text-sm">{usuario?.nome}</p>
            <p className="text-[11px] text-muted-foreground/60">{usuario?.email}</p>
            <div className="flex items-center gap-1.5 text-[11px] mt-1">
              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground/50" />
              {expiraAtual ? (
                <span className={cn(estaExpirado ? "text-red-500 font-semibold" : "text-muted-foreground/70")}>
                  Acesso atual: {estaExpirado ? "expirou em" : "expira em"} {formatDate(usuario!.acessoExpiraEm!)}
                </span>
              ) : (
                <span className="text-emerald-600 font-semibold">Acesso permanente (sem prazo definido)</span>
              )}
            </div>
          </div>

          {/* Presets */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground/70 uppercase tracking-wider">Dias a adicionar</p>
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
                onChange={(e) => onDiasChange(Math.max(1, Math.min(3650, Number(e.target.value))))}
                className="h-9 rounded-lg w-24 text-center font-semibold tabular-nums"
              />
              <span className="text-sm text-muted-foreground">dias</span>
            </div>
          </div>

          {/* New expiry preview */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <p className="text-[11px] text-muted-foreground/60 mb-0.5">Nova data de expiração</p>
            <p className="font-bold text-primary">
              {novaExpiracao.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
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

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending || dias < 1}
            className="gap-2 rounded-xl font-bold"
          >
            {isPending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Salvando...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Estender Acesso
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

