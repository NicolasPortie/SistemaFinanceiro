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
} from "lucide-react";
import { useState } from "react";
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
            <div className="grid grid-cols-2 gap-3 text-sm">
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

            {/* Finance summary */}
            <div className="border-t pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-3 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />Resumo Financeiro
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Receita média", value: detalhe.receitaMedia, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                  { label: "Gasto médio", value: detalhe.gastoMedio, color: "text-red-500", bg: "bg-red-500/10" },
                  { label: "Saldo atual", value: detalhe.saldoAtual, color: detalhe.saldoAtual >= 0 ? "text-emerald-500" : "text-red-500", bg: detalhe.saldoAtual >= 0 ? "bg-emerald-500/10" : "bg-red-500/10" },
                ].map((f) => (
                  <div key={f.label} className={cn("rounded-xl p-3 text-center", f.bg)}>
                    <p className="text-[10px] text-muted-foreground/70 mb-1">{f.label}</p>
                    <p className={cn("font-extrabold text-sm", f.color)}>{formatCurrency(f.value)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Cards */}
            {detalhe.cartoes.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">Cartões ({detalhe.cartoes.length})</p>
                <div className="space-y-1.5">
                  {detalhe.cartoes.map((c) => (
                    <div key={c.id} className="flex justify-between text-sm py-1.5 border-b border-border/20 last:border-0">
                      <span className="font-medium">{c.nome}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground/60 text-xs">Limite: {formatCurrency(c.limite)}</span>
                        {!c.ativo && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Goals */}
            {detalhe.metasAtivas.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">Metas ativas ({detalhe.metasAtivas.length})</p>
                <div className="space-y-1.5">
                  {detalhe.metasAtivas.map((m) => (
                    <div key={m.id} className="flex justify-between text-sm py-1.5 border-b border-border/20 last:border-0">
                      <span className="font-medium">{m.nome}</span>
                      <span className="text-muted-foreground/60 text-xs">{formatCurrency(m.valorAtual)} / {formatCurrency(m.valorAlvo)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent transactions */}
            {detalhe.ultimosLancamentos.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">Últimos lançamentos</p>
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {detalhe.ultimosLancamentos.map((l) => (
                    <div key={l.id} className="flex justify-between text-sm py-1.5 border-b border-border/20 last:border-0">
                      <div>
                        <span className="font-medium">{l.descricao}</span>
                        <span className="text-xs text-muted-foreground/50 ml-2">({l.categoria})</span>
                      </div>
                      <span className={cn("font-semibold text-xs", l.tipo === "Receita" ? "text-emerald-500" : "text-red-500")}>
                        {l.tipo === "Receita" ? "+" : "-"}{formatCurrency(l.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

