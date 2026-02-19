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
  Info,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { motion, AnimatePresence } from "framer-motion";
import { PageShell, PageHeader, ErrorState, CardSkeleton } from "@/components/shared/page-components";
import { cn } from "@/lib/utils";

// ── Helpers ────────────────────────────────

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

function formatHorasExpiracao(horas: number): string {
  if (horas >= 24) {
    const dias = Math.floor(horas / 24);
    const horasRestantes = horas % 24;
    return horasRestantes > 0 ? `${dias}d ${horasRestantes}h` : `${dias}d`;
  }
  return `${horas}h`;
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

// ── Main Component ─────────────────────────

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
    if (c.usado && !c.ilimitado) return { label: "Usado", color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: CheckCircle2 };
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
      <div className="grid gap-3 grid-cols-3">
        {[
          { label: "Disponíveis", value: ativos.length, color: "text-emerald-500", bg: "bg-emerald-500/10", icon: Send },
          { label: "Usados", value: usados.length, color: "text-blue-500", bg: "bg-blue-500/10", icon: CheckCircle2 },
          { label: "Expirados", value: expirados.length, color: "text-red-500", bg: "bg-red-500/10", icon: XCircle },
        ].map((item) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-premium p-4 flex items-center gap-3"
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
        <AnimatePresence mode="popLayout">
          {convites?.map((c, i) => {
            const status = getStatus(c);
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.03 }}
                className="card-premium p-4 group"
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
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-blue-500/8 text-blue-600 dark:text-blue-400">
                          <Users className="h-3 w-3" />
                          {c.usadoPorNome}
                          {c.usadoEm && ` · ${formatDate(c.usadoEm)}`}
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
            className="card-premium p-10 flex flex-col items-center justify-center text-center"
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

      {/* ── Remove Confirmation ── */}
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
              disabled={remover.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Create Dialog ── */}
      <Dialog open={showCreate} onOpenChange={(open) => !open && handleCloseCreate()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Gift className="h-4.5 w-4.5" />
              </div>
              Gerar Convite
            </DialogTitle>
            <DialogDescription>
              Cada código só pode ser usado <strong>uma única vez</strong>. Ao se cadastrar com o código, o convidado recebe acesso ao sistema pelo tempo que você definir.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Descrição */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Para quem é esse convite? <span className="normal-case font-normal text-muted-foreground/50">(opcional)</span>
              </Label>
              <Input
                placeholder="Ex: João, Maria, teste..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                maxLength={200}
                className="h-10 rounded-xl"
              />
            </div>

            {/* ── Tempo de Acesso ao Sistema ── */}
            <div className="space-y-3 rounded-xl border border-primary/15 bg-primary/3 p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold">Tempo de Acesso ao Sistema</p>
                  <p className="text-[11px] text-muted-foreground/60">Por quanto tempo o convidado poderá usar o sistema após ativar o código</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/30">
                <Label htmlFor="acessoPermanente" className="cursor-pointer text-sm font-medium">Acesso permanente</Label>
                <Switch id="acessoPermanente" checked={acessoPermanente} onCheckedChange={setAcessoPermanente} />
              </div>

              {!acessoPermanente && (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {PRESETS_ACESSO.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setDiasAcesso(p.value)}
                        className={cn(
                          "px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all",
                          diasAcesso === p.value
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
                      value={diasAcesso}
                      onChange={(e) => setDiasAcesso(Number(e.target.value))}
                      className="h-9 rounded-lg w-24 text-center font-semibold tabular-nums"
                    />
                    <span className="text-sm text-muted-foreground">dias</span>
                    <span className="text-xs text-muted-foreground/50 ml-auto">= {formatDuration(diasAcesso)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Prazo para Ativar o Código ── */}
            <div className="space-y-3 rounded-xl border border-amber-500/15 bg-amber-500/3 p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Timer className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold">Prazo para Ativar o Código</p>
                  <p className="text-[11px] text-muted-foreground/60">Quanto tempo o convidado tem para usar o código e se cadastrar</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/30">
                <Label htmlFor="codigoPermanente" className="cursor-pointer text-sm font-medium">Sem prazo (nunca expira)</Label>
                <Switch id="codigoPermanente" checked={codigoPermanente} onCheckedChange={setCodigoPermanente} />
              </div>

              {!codigoPermanente && (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {PRESETS_EXPIRACAO.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setHorasValidade(p.value)}
                        className={cn(
                          "px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all",
                          horasValidade === p.value
                            ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                            : "bg-background border-border/50 text-muted-foreground hover:border-amber-500/40 hover:text-foreground"
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
                      max={87600}
                      value={horasValidade}
                      onChange={(e) => setHorasValidade(Number(e.target.value))}
                      className="h-9 rounded-lg w-24 text-center font-semibold tabular-nums"
                    />
                    <span className="text-sm text-muted-foreground">horas</span>
                    <span className="text-xs text-muted-foreground/50 ml-auto">= {formatHorasExpiracao(horasValidade)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quantidade */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quantidade de códigos</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={quantidade}
                  onChange={(e) => setQuantidade(Number(e.target.value))}
                  className="h-10 rounded-xl w-24 text-center font-semibold tabular-nums"
                />
                {quantidade > 1 && (
                  <p className="text-xs text-muted-foreground/60">
                    {quantidade} códigos com as mesmas configurações
                  </p>
                )}
              </div>
            </div>

            {/* Resumo */}
            <div className="rounded-xl border border-border/40 bg-muted/20 p-3.5 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Resumo do convite
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground/60 text-xs">Acesso ao sistema</span>
                  <p className="font-semibold">{acessoPermanente ? "Permanente" : formatDuration(diasAcesso)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground/60 text-xs">Prazo p/ ativar</span>
                  <p className="font-semibold">{codigoPermanente ? "Sem prazo" : formatHorasExpiracao(horasValidade)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground/60 text-xs">Uso por código</span>
                  <p className="font-semibold">Único (1x)</p>
                </div>
                <div>
                  <span className="text-muted-foreground/60 text-xs">Códigos a gerar</span>
                  <p className="font-semibold">{quantidade}</p>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="flex items-start gap-2.5 text-xs text-muted-foreground/50">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <p>O convidado usará o código ao se cadastrar. Após ativar, terá acesso ao sistema pelo tempo configurado.</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCloseCreate} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={() => criar.mutate()}
              disabled={criar.isPending}
              className="gap-2 rounded-xl font-bold shadow-premium btn-premium"
            >
              {criar.isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Gerando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {quantidade > 1 ? `Gerar ${quantidade} Convites` : "Gerar Convite"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
