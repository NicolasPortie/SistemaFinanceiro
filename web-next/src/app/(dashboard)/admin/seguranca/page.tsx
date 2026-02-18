"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type AdminSegurancaResumo } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Monitor,
  LogOut,
  AlertTriangle,
  ShieldAlert,
  Wifi,
  Clock,
  Info,
  Trash2,
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
import { motion, AnimatePresence } from "framer-motion";
import { PageShell, PageHeader, ErrorState, CardSkeleton } from "@/components/shared/page-components";
import { cn } from "@/lib/utils";

export default function AdminSegurancaPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery<AdminSegurancaResumo>({
    queryKey: ["admin", "seguranca"],
    queryFn: () => api.admin.seguranca.resumo(),
  });

  const revogarSessao = useMutation({
    mutationFn: (tokenId: number) => api.admin.seguranca.revogarSessao(tokenId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Sessão encerrada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revogarTodas = useMutation({
    mutationFn: () => api.admin.seguranca.revogarTodas(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Todas as sessões foram encerradas");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <PageShell>
        <PageHeader title="Sessões Ativas" description="Veja quem está logado no sistema agora" />
        <CardSkeleton count={3} />
      </PageShell>
    );
  }

  if (isError || !data) {
    return (
      <PageShell>
        <PageHeader title="Sessões Ativas" description="Veja quem está logado no sistema agora" />
        <ErrorState message={error?.message ?? "Erro ao carregar dados"} onRetry={() => queryClient.invalidateQueries({ queryKey: ["admin", "seguranca"] })} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title="Sessões Ativas" description="Veja quem está logado no sistema agora e encerre acessos suspeitos">
        {data.sessoesAtivas > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-2 h-9 rounded-xl font-bold">
                <LogOut className="h-4 w-4" />
                Encerrar Todas
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Encerrar TODAS as sessões?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso vai deslogar <strong>todos os usuários</strong> do sistema, incluindo você. Todos precisarão fazer login novamente. Use somente se suspeitar de acesso não autorizado.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => revogarTodas.mutate()}
                  disabled={revogarTodas.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Encerrar Todas
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </PageHeader>

      {/* What is this page — explanation */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 rounded-xl border border-blue-500/15 bg-blue-500/5 p-4 text-sm"
      >
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-blue-600 dark:text-blue-400">O que é uma sessão?</p>
          <p className="text-muted-foreground/70 text-[13px]">
            Cada vez que alguém faz login, uma sessão é criada. Esta página lista todas as sessões abertas agora — ou seja, quem ainda está logado. Você pode encerrar uma sessão específica (forçar logout), ou encerrar todas de uma vez em caso de emergência.
          </p>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        {[
          {
            label: "Sessões abertas agora",
            value: data.sessoesAtivas,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
            icon: Monitor,
            hint: "Logins ativos no momento",
          },
          {
            label: "Usuários bloqueados",
            value: data.usuariosBloqueados,
            color: data.usuariosBloqueados > 0 ? "text-red-500" : "text-muted-foreground",
            bg: data.usuariosBloqueados > 0 ? "bg-red-500/10" : "bg-muted/60",
            icon: ShieldAlert,
            hint: "Bloqueados por senha errada — gerencie em Usuários",
          },
          {
            label: "Erros de senha (total)",
            value: data.tentativasLoginFalhadas,
            color: data.tentativasLoginFalhadas > 0 ? "text-amber-500" : "text-muted-foreground",
            bg: data.tentativasLoginFalhadas > 0 ? "bg-amber-500/10" : "bg-muted/60",
            icon: AlertTriangle,
            hint: "Total de tentativas de login falhadas",
          },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card-premium p-4 group"
            title={item.hint}
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11px] text-muted-foreground/60 font-semibold leading-tight max-w-[80%]">{item.label}</p>
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", item.bg)}>
                <item.icon className={cn("h-3.5 w-3.5", item.color)} />
              </div>
            </div>
            <p className={cn("text-3xl font-extrabold tabular-nums", item.color)}>{item.value}</p>
            <p className="text-[10px] text-muted-foreground/40 mt-1">{item.hint}</p>
          </motion.div>
        ))}
      </div>

      {/* Sessions List */}
      <div className="space-y-2.5">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50 px-0.5 flex items-center gap-1.5">
          <Wifi className="h-3 w-3" />
          {data.sessoes.length === 0 ? "Nenhuma sessão ativa" : `${data.sessoes.length} sessão(ões) ativa(s)`}
        </p>

        <AnimatePresence mode="popLayout">
          {data.sessoes.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.03 }}
              className="card-premium p-4"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm">{s.usuarioNome}</p>
                    <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block animate-pulse" />
                      Logado agora
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground/60">{s.usuarioEmail}</p>
                  <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground/50 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Login em {formatDate(s.criadoEm)}
                    </span>
                    <span>·</span>
                    <span>Expira em {formatDate(s.expiraEm)}</span>
                    {s.ipCriacao && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Monitor className="h-3 w-3" />
                          IP: {s.ipCriacao}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs rounded-lg gap-1.5 text-red-600 hover:text-red-600 hover:border-red-500/40 hover:bg-red-500/5"
                      disabled={revogarSessao.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Encerrar sessão
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Encerrar sessão de {s.usuarioNome}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O usuário será deslogado imediatamente e precisará fazer login novamente. Use isso se suspeitar que a conta está sendo acessada indevidamente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => revogarSessao.mutate(s.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        <LogOut className="h-4 w-4 mr-1" />
                        Encerrar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {data.sessoes.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card-premium p-10 flex flex-col items-center justify-center text-center"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 mb-4">
              <Monitor className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="font-semibold text-muted-foreground/60">Nenhuma sessão ativa no momento</p>
            <p className="text-xs text-muted-foreground/40 mt-1">Quando alguém fizer login, a sessão aparecerá aqui.</p>
          </motion.div>
        )}
      </div>
    </PageShell>
  );
}
