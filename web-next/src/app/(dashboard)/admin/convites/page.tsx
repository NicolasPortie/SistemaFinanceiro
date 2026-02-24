"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type AdminCodigoConvite } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Copy,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  Send,
  CalendarClock,
  Timer,
  ShieldCheck,
  Gift,
} from "lucide-react";
import { useState } from "react";
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
import { motion, AnimatePresence } from "framer-motion";
import { PageShell, PageHeader, ErrorState, CardSkeleton } from "@/components/shared/page-components";
import { cn } from "@/lib/utils";

// -- Helpers --------------------------------

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

// -- Main Component -------------------------

export default function AdminConvitesPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  // Form state
  const [descricao, setDescricao] = useState("");
  const [horasValidade, setHorasValidade] = useState(48);
  const [codigoPermanente, setCodigoPermanente] = useState(false);
  const [diasAcesso, setDiasAcesso] = useState(30);
  const [acessoPermanente, setAcessoPermanente] = useState(false);
  const [quantidade, setQuantidade] = useState(1);

  const { data: convites, isLoading, isError, error } = useQuery({
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
        navigator.clipboard.writeText(data[0].codigo).catch(() => {});
        toast.success(`Código gerado e copiado: ${data[0].codigo}`);
      } else {
        toast.success(`${data.length} códigos gerados com sucesso!`);
      }
      handleCloseCreate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remover = useMutation({
    mutationFn: (id: number) => api.admin.convites.remover(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "convites"] });
      toast.success("Código removido");
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
      await navigator.clipboard.writeText(codigo);
      toast.success("Código copiado!");
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const getStatus = (c: AdminCodigoConvite) => {
    if (c.usado && !c.ilimitado) return { label: "Usado", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: CheckCircle2 };
    if (c.expirado) return { label: "Expirado", color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", icon: XCircle };
    if (c.usosRealizados > 0 && !c.usado) return { label: "Em uso", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: Users };
    return { label: "Disponível", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: Clock };
  };

  const ativos = convites?.filter((c) => !c.usado && !c.expirado) ?? [];
  const usados = convites?.filter((c) => c.usado) ?? [];
  const expirados = convites?.filter((c) => c.expirado && !c.usado) ?? [];

  if (isLoading) {
    return (
      <PageShell>
        <PageHeader title="Convites" description="Gerencie os convites para novos usuários" />
        <CardSkeleton count={4} />
      </PageShell>
    );
  }

  if (isError) {
    return (
      <PageShell>
        <PageHeader title="Convites" description="Gerencie os convites para novos usuários" />
        <ErrorState message={error?.message ?? "Erro ao carregar convites"} onRetry={() => queryClient.invalidateQueries({ queryKey: ["admin", "convites"] })} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title="Convites" description="Gere códigos para convidar pessoas ao sistema">
        <Button onClick={() => setShowCreate(true)} className="gap-2 h-10 rounded-xl font-bold shadow-premium btn-premium">
          <Plus className="h-4 w-4" />
          Gerar Convite
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {[
          { label: "Disponíveis", value: ativos.length, color: "text-emerald-500", bg: "bg-emerald-500/10", icon: Send },
          { label: "Usados", value: usados.length, color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 },
          { label: "Expirados", value: expirados.length, color: "text-red-500", bg: "bg-red-500/10", icon: XCircle },
        ].map((item) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-2xl p-4 flex items-center gap-3"
          >
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", item.bg)}>
              <item.icon className={cn("h-4.5 w-4.5", item.color)} />
            </div>
            <div>
              <p className={cn("text-2xl font-extrabold tabular-nums", item.color)}>{item.value}</p>
              <p className="text-[11px] text-muted-foreground/60 font-medium">{item.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Codes List */}
      <div className="space-y-2.5">
        <AnimatePresence>
          {convites?.map((c, i) => {
            const status = getStatus(c);
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.03 }}
                className="glass-panel rounded-2xl p-4 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Code + Status */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <code className="text-base sm:text-lg font-mono font-extrabold tracking-[0.2em] text-foreground/90">{c.codigo}</code>
                      <Badge className={cn("text-[10px] px-2 py-0.5 border", status.bg, status.color, status.border)}>
                        <status.icon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>

                    {c.descricao && (
                      <p className="text-sm text-muted-foreground/70">{c.descricao}</p>
                    )}

                    {/* Info chips */}
                    <div className="flex flex-wrap gap-2">
                      {/* Duração do acesso */}
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-primary/8 text-primary">
                        <ShieldCheck className="h-3 w-3" />
                        Acesso: {formatDuration(c.duracaoAcessoDias)}
                      </span>

                      {/* Tempo para ativar */}
                      {c.permanente ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/8 text-emerald-600 dark:text-emerald-400">
                          <Timer className="h-3 w-3" />
                          Sem prazo p/ ativar
                        </span>
                      ) : c.expiraEm ? (
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md",
                          c.expirado ? "bg-red-500/8 text-red-500" : "bg-amber-500/8 text-amber-600 dark:text-amber-400"
                        )}>
                          <Timer className="h-3 w-3" />
                          {c.expirado ? "Expirou" : "Ativar até"} {formatDate(c.expiraEm)}
                        </span>
                      ) : null}

                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/50 font-medium">
                        <CalendarClock className="h-3 w-3" />
                        Criado {formatDate(c.criadoEm)}
                      </span>

                      {c.usado && c.usadoPorNome && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/8 text-emerald-600 dark:text-emerald-400">
                          <Users className="h-3 w-3" />
                          {c.usadoPorNome}
                          {c.usadoEm && ` — ${formatDate(c.usadoEm)}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!c.usado && !c.expirado && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 rounded-lg"
                        onClick={() => copiarCodigo(c.codigo)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground/50 hover:text-red-500"
                      onClick={() => setRemovingId(c.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {(!convites || convites.length === 0) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel rounded-2xl p-10 flex flex-col items-center justify-center text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
              <Gift className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold mb-1.5">Nenhum convite gerado</h3>
            <p className="text-sm text-muted-foreground/60 mb-5 max-w-sm">
              Gere um código de convite para permitir que outras pessoas se cadastrem no sistema.
            </p>
            <Button onClick={() => setShowCreate(true)} className="gap-2 rounded-xl font-bold shadow-premium btn-premium">
              <Plus className="h-4 w-4" />
              Gerar Primeiro Convite
            </Button>
          </motion.div>
        )}
      </div>

      {/* -- Remove Confirmation -- */}
      <AlertDialog open={removingId !== null} onOpenChange={() => setRemovingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover código de convite?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O código será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removingId && remover.mutate(removingId)}
              loading={remover.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* -- Create Dialog -- */}
      <Dialog open={showCreate} onOpenChange={(open) => !open && handleCloseCreate()}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {/* Header */}
          <DialogHeader className="pb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
              <Send className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold">Criar Novo Convite</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Configure as permissões e validade para o novo acesso.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* ── Duração do Acesso ── */}
            <div>
              <Label className="block text-sm font-semibold text-foreground mb-2">
                Duração do Acesso
              </Label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {PRESETS_ACESSO.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => { setDiasAcesso(p.value); setAcessoPermanente(false); }}
                    className={cn(
                      "px-3 py-2 text-sm font-medium rounded-xl border transition-colors",
                      !acessoPermanente && diasAcesso === p.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:border-border/80",
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
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">dias</span>
              </div>
              <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border/30">
                <div>
                  <p className="text-sm font-semibold">Acesso permanente</p>
                  <p className="text-[11px] text-muted-foreground/60">Sem prazo de expiração de acesso</p>
                </div>
                <Switch id="acessoPermanente" checked={acessoPermanente} onCheckedChange={setAcessoPermanente} />
              </div>
            </div>

            {/* ── Expiração do Código ── */}
            <div>
              <Label className="block text-sm font-semibold text-foreground mb-2">
                Expiração do Código
              </Label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {PRESETS_EXPIRACAO.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => { setHorasValidade(p.value); setCodigoPermanente(false); }}
                    className={cn(
                      "px-3 py-2 text-sm font-medium rounded-xl border transition-colors",
                      !codigoPermanente && horasValidade === p.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:border-border/80",
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
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">horas</span>
              </div>
              <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border/30">
                <div>
                  <p className="text-sm font-semibold">Sem prazo (nunca expira)</p>
                  <p className="text-[11px] text-muted-foreground/60">O código pode ser usado a qualquer momento</p>
                </div>
                <Switch id="codigoPermanente" checked={codigoPermanente} onCheckedChange={setCodigoPermanente} />
              </div>
            </div>

            {/* ── Uso Único ── */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Uso Único</p>
                <p className="text-[11px] text-muted-foreground/60">O convite expira após o primeiro uso</p>
              </div>
              <Switch checked id="usoUnico" disabled />
            </div>

            {/* ── Quantidade + Descrição ── */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={quantidade}
                  onChange={(e) => setQuantidade(Math.max(1, Math.min(50, Number(e.target.value))))}
                  className="h-10 rounded-full text-center font-semibold tabular-nums bg-muted/30 border-border/60"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Descrição <span className="font-normal opacity-60">(opcional)</span>
                </Label>
                <Input
                  placeholder="Ex: João, amigo..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  maxLength={200}
                  className="h-10 rounded-full bg-muted/30 border-border/60"
                />
              </div>
            </div>

            {/* ── Submit ── */}
            <Button
              onClick={() => criar.mutate()}
              loading={criar.isPending}
              className="w-full gap-2 h-11 rounded-full font-semibold text-sm bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
            >
              <Send className="h-4 w-4" />
              {quantidade > 1 ? `Gerar ${quantidade} Convites` : "Gerar Convite"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
