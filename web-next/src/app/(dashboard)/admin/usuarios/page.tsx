"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type AdminUsuario } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { formatDate, formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Users,
  Shield,
  ShieldOff,
  Crown,
  Ban,
  Unlock,
  RotateCcw,
  Eye,
  UserX,
  UserCheck,
  Trash2,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


export default function AdminUsuariosPage() {
  const queryClient = useQueryClient();
  const { usuario: currentUser } = useAuth();
  const [selectedUser, setSelectedUser] = useState<AdminUsuario | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    userId: number;
    action: string;
    label: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["admin", "usuarios"],
    queryFn: () => api.admin.usuarios.listar(),
  });

  const bloquear = useMutation({
    mutationFn: (id: number) => api.admin.usuarios.bloquear(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Usuário bloqueado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const desbloquear = useMutation({
    mutationFn: (id: number) => api.admin.usuarios.desbloquear(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Usuário desbloqueado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const desativar = useMutation({
    mutationFn: (id: number) => api.admin.usuarios.desativar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Status alterado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetarLogin = useMutation({
    mutationFn: (id: number) => api.admin.usuarios.resetarLogin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Login resetado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revogarSessoes = useMutation({
    mutationFn: (id: number) => api.admin.usuarios.revogarSessoes(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Sessões revogadas");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const promover = useMutation({
    mutationFn: (id: number) => api.admin.usuarios.promover(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Usuário promovido a administrador");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rebaixar = useMutation({
    mutationFn: (id: number) => api.admin.usuarios.rebaixar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Usuário rebaixado a usuário comum");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isSelf = (u: AdminUsuario) => u.id === currentUser?.id;

  const isBloqueado = (u: AdminUsuario) =>
    u.bloqueadoAte && new Date(u.bloqueadoAte) > new Date();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-blue-500" />
          Gerenciar Usuários
        </h1>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-500" />
            Gerenciar Usuários
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {usuarios?.length ?? 0} usuário(s) cadastrado(s)
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {usuarios?.map((u) => (
          <Card key={u.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{u.nome}</p>
                    {u.role === "Admin" && (
                      <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/20 text-[10px]">
                        <Shield className="h-3 w-3 mr-1" />
                        Admin
                      </Badge>
                    )}
                    {!u.ativo && (
                      <Badge variant="secondary" className="text-[10px]">Inativo</Badge>
                    )}
                    {isBloqueado(u) && (
                      <Badge variant="destructive" className="text-[10px]">Bloqueado</Badge>
                    )}
                    {u.telegramVinculado && (
                      <Badge variant="outline" className="text-[10px]">Telegram</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>
                  <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground">
                    <span>Desde {formatDate(u.criadoEm)}</span>
                    <span>{u.totalLancamentos} lançamentos</span>
                    <span>{u.totalCartoes} cartões</span>
                    <span>{u.totalMetas} metas</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setSelectedUser(u)}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Detalhes
                  </Button>

                  {/* Promote / Demote — nunca para si mesmo */}
                  {!isSelf(u) && (
                    u.role === "Admin" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs text-amber-600"
                        onClick={() => rebaixar.mutate(u.id)}
                        disabled={rebaixar.isPending}
                      >
                        <ShieldOff className="h-3.5 w-3.5 mr-1" />
                        Rebaixar
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs text-violet-600"
                        onClick={() => promover.mutate(u.id)}
                        disabled={promover.isPending}
                      >
                        <Crown className="h-3.5 w-3.5 mr-1" />
                        Promover
                      </Button>
                    )
                  )}

                  {/* Ações de moderação — não para admins (exceto revogar sessões) */}
                  {!isSelf(u) && u.role !== "Admin" && (
                    <>
                      {isBloqueado(u) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-emerald-600"
                          onClick={() => setConfirmAction({
                            userId: u.id,
                            action: "desbloquear",
                            label: `Desbloquear ${u.nome}?`,
                            description: "O usuário poderá acessar o sistema novamente.",
                            onConfirm: () => desbloquear.mutate(u.id),
                          })}
                          disabled={desbloquear.isPending}
                        >
                          <Unlock className="h-3.5 w-3.5 mr-1" />
                          Desbloquear
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-red-600"
                          onClick={() => setConfirmAction({
                            userId: u.id,
                            action: "bloquear",
                            label: `Bloquear ${u.nome}?`,
                            description: "O usuário será bloqueado temporariamente e não poderá acessar o sistema.",
                            onConfirm: () => bloquear.mutate(u.id),
                          })}
                          disabled={bloquear.isPending}
                        >
                          <Ban className="h-3.5 w-3.5 mr-1" />
                          Bloquear
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setConfirmAction({
                          userId: u.id,
                          action: u.ativo ? "desativar" : "ativar",
                          label: u.ativo ? `Desativar ${u.nome}?` : `Ativar ${u.nome}?`,
                          description: u.ativo
                            ? "A conta do usuário será desativada."
                            : "A conta do usuário será reativada.",
                          onConfirm: () => desativar.mutate(u.id),
                        })}
                        disabled={desativar.isPending}
                      >
                        {u.ativo ? (
                          <>
                            <UserX className="h-3.5 w-3.5 mr-1" />
                            Desativar
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3.5 w-3.5 mr-1" />
                            Ativar
                          </>
                        )}
                      </Button>

                      {u.tentativasLoginFalhadas > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-amber-600"
                          onClick={() => resetarLogin.mutate(u.id)}
                          disabled={resetarLogin.isPending}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Resetar ({u.tentativasLoginFalhadas})
                        </Button>
                      )}
                    </>
                  )}

                  {/* Revogar sessões — para qualquer um exceto si mesmo */}
                  {!isSelf(u) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs text-orange-600"
                      onClick={() => setConfirmAction({
                        userId: u.id,
                        action: "revogar",
                        label: `Revogar sessões de ${u.nome}?`,
                        description: "Todas as sessões ativas do usuário serão encerradas.",
                        onConfirm: () => revogarSessoes.mutate(u.id),
                      })}
                      disabled={revogarSessoes.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Sessões
                    </Button>
                  )}

                  {isSelf(u) && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Você
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!usuarios || usuarios.length === 0) && !isLoading && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">Nenhum usuário encontrado.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detail Dialog */}
      <UserDetailDialog
        usuario={selectedUser}
        onClose={() => setSelectedUser(null)}
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
              onClick={() => {
                confirmAction?.onConfirm();
                setConfirmAction(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

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

  return (
    <Dialog open={!!usuario} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Detalhes do Usuário
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : detalhe ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Nome:</span>
                <p className="font-medium">{detalhe.nome}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span>
                <p className="font-medium">{detalhe.email}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Desde:</span>
                <p className="font-medium">{formatDate(detalhe.criadoEm)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Role:</span>
                <p className="font-medium">{detalhe.role}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Sessões Ativas:</span>
                <p className="font-medium">{detalhe.sessoesAtivas}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Telegram:</span>
                <p className="font-medium">{detalhe.telegramVinculado ? "Vinculado" : "Não vinculado"}</p>
              </div>
            </div>

            <div className="border-t pt-3">
              <h3 className="text-sm font-semibold mb-2">Finanças do Mês</h3>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-emerald-500/10 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Receitas</p>
                  <p className="font-bold text-emerald-500">
                    {formatCurrency(detalhe.receitaMedia)}
                  </p>
                </div>
                <div className="bg-red-500/10 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Gastos</p>
                  <p className="font-bold text-red-500">
                    {formatCurrency(detalhe.gastoMedio)}
                  </p>
                </div>
                <div className="bg-blue-500/10 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Saldo</p>
                  <p className={`font-bold ${detalhe.saldoAtual >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {formatCurrency(detalhe.saldoAtual)}
                  </p>
                </div>
              </div>
            </div>

            {detalhe.cartoes.length > 0 && (
              <div className="border-t pt-3">
                <h3 className="text-sm font-semibold mb-2">Cartões ({detalhe.cartoes.length})</h3>
                <div className="space-y-1.5">
                  {detalhe.cartoes.map((c) => (
                    <div key={c.id} className="flex justify-between text-sm py-1 border-b border-border/20">
                      <span>{c.nome}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">
                          Limite: {formatCurrency(c.limite)}
                        </span>
                        {!c.ativo && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detalhe.metasAtivas.length > 0 && (
              <div className="border-t pt-3">
                <h3 className="text-sm font-semibold mb-2">Metas Ativas ({detalhe.metasAtivas.length})</h3>
                <div className="space-y-1.5">
                  {detalhe.metasAtivas.map((m) => (
                    <div key={m.id} className="flex justify-between text-sm py-1 border-b border-border/20">
                      <span>{m.nome}</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(m.valorAtual)} /{" "}
                        {formatCurrency(m.valorAlvo)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detalhe.ultimosLancamentos.length > 0 && (
              <div className="border-t pt-3">
                <h3 className="text-sm font-semibold mb-2">Últimos Lançamentos</h3>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {detalhe.ultimosLancamentos.map((l) => (
                    <div key={l.id} className="flex justify-between text-sm py-1 border-b border-border/20">
                      <div>
                        <span>{l.descricao}</span>
                        <span className="text-xs text-muted-foreground ml-2">({l.categoria})</span>
                      </div>
                      <span className={l.tipo === "Receita" ? "text-emerald-500" : "text-red-500"}>
                        {l.tipo === "Receita" ? "+" : "-"}
                        {formatCurrency(l.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
