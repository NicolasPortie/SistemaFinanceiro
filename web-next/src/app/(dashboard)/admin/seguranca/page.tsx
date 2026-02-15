"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type AdminSegurancaResumo } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Lock,

  Trash2,
  AlertTriangle,
  Monitor,
  Unlock,
  Ban,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AdminSegurancaPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<AdminSegurancaResumo>({
    queryKey: ["admin", "seguranca"],
    queryFn: () => api.admin.seguranca.resumo(),
  });

  const revogarSessao = useMutation({
    mutationFn: (tokenId: number) => api.admin.seguranca.revogarSessao(tokenId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Sessão revogada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revogarTodas = useMutation({
    mutationFn: () => api.admin.seguranca.revogarTodas(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Todas as sessões foram revogadas");
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Lock className="h-6 w-6 text-orange-500" />
          Segurança
        </h1>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lock className="h-6 w-6 text-orange-500" />
            Segurança
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitoramento de sessões e autenticação
          </p>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="gap-1.5">
              <Trash2 className="h-4 w-4" />
              Revogar Todas as Sessões
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revogar TODAS as sessões?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso vai deslogar todos os usuários do sistema, incluindo você.
                Todos terão que fazer login novamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => revogarTodas.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Revogar Todas
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground">Sessões Ativas</span>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Monitor className="h-4 w-4 text-emerald-500" />
              </div>
            </div>
            <p className="text-3xl font-bold">{data.sessoesAtivas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground">Usuários Bloqueados</span>
              <div className="p-2 rounded-lg bg-red-500/10">
                <Ban className="h-4 w-4 text-red-500" />
              </div>
            </div>
            <p className="text-3xl font-bold">{data.usuariosBloqueados}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground">Tentativas Falhas</span>
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
            </div>
            <p className="text-3xl font-bold">{data.tentativasLoginFalhadas}</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="h-4 w-4 text-emerald-500" />
            Sessões Ativas ({data.sessoes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.sessoes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma sessão ativa.</p>
          ) : (
            <div className="space-y-2">
              {data.sessoes.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0 flex-wrap gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{s.usuarioNome}</span>
                      <span className="text-xs text-muted-foreground">{s.usuarioEmail}</span>
                    </div>
                    <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>Criada em {formatDate(s.criadoEm)}</span>
                      <span>Expira em {formatDate(s.expiraEm)}</span>
                      {s.ipCriacao && <span>IP: {s.ipCriacao}</span>}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-red-600"
                    onClick={() => revogarSessao.mutate(s.id)}
                    disabled={revogarSessao.isPending}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Revogar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Blocked Users */}
      {data.usuariosBloqueadosLista.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Ban className="h-4 w-4 text-red-500" />
              Usuários Bloqueados ({data.usuariosBloqueadosLista.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.usuariosBloqueadosLista.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0 flex-wrap gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{u.nome}</span>
                    <span className="text-xs text-muted-foreground ml-2">{u.email}</span>
                    <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>{u.tentativasLoginFalhadas} tentativas falhadas</span>
                      {u.bloqueadoAte && <span>Bloqueado até {formatDate(u.bloqueadoAte)}</span>}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-emerald-600"
                    onClick={() => desbloquear.mutate(u.id)}
                    disabled={desbloquear.isPending}
                  >
                    <Unlock className="h-3 w-3 mr-1" />
                    Desbloquear
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
