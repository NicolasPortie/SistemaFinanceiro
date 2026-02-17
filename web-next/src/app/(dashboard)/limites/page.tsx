"use client";

import { useState } from "react";
import { useLimites, useCategorias, useDefinirLimite, useRemoverLimite } from "@/hooks/use-queries";
import { formatCurrency, statusColor } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gauge,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Shield,
  BarChart3,
} from "lucide-react";
import {
  PageShell,
  PageHeader,
  StatCard,
  EmptyState,
  ErrorState,
  CardSkeleton,
} from "@/components/shared/page-components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

function statusIcon(status: string) {
  switch (status) {
    case "ok": return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    case "atencao": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case "critico": return <AlertCircle className="h-5 w-5 text-red-500" />;
    case "excedido": return <XCircle className="h-5 w-5 text-red-600" />;
    default: return <Gauge className="h-5 w-5" />;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "ok": return "Dentro do limite";
    case "atencao": return "Atenção";
    case "critico": return "Crítico";
    case "excedido": return "Excedido";
    default: return status;
  }
}

function statusBgColor(status: string) {
  switch (status) {
    case "ok": return "bg-emerald-100 dark:bg-emerald-500/15";
    case "atencao": return "bg-amber-100 dark:bg-amber-500/15";
    case "critico": return "bg-red-100 dark:bg-red-500/15";
    case "excedido": return "bg-red-100 dark:bg-red-500/15";
    default: return "bg-muted/50";
  }
}

function progressColor(status: string) {
  switch (status) {
    case "ok": return "bg-emerald-500";
    case "atencao": return "bg-amber-500";
    case "critico": return "bg-red-500";
    case "excedido": return "bg-red-600";
    default: return "bg-primary";
  }
}

export default function LimitesPage() {
  const { data: limites = [], isLoading: loading, isError, error, refetch } = useLimites();
  const { data: categorias = [] } = useCategorias();
  const definirLimite = useDefinirLimite();
  const removerLimite = useRemoverLimite();

  const [showForm, setShowForm] = useState(false);
  const [categoria, setCategoria] = useState("");
  const [valor, setValor] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const categoriasDisponiveis = categorias.filter(
    (c) => !limites.find((l) => l.categoriaNome === c.nome)
  );

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorNum = parseFloat(valor.replace(",", "."));
    if (isNaN(valorNum) || valorNum <= 0) { toast.error("Informe um valor válido"); return; }
    definirLimite.mutate(
      { categoria, valor: valorNum },
      { onSuccess: () => { setCategoria(""); setValor(""); setShowForm(false); } }
    );
  };

  const handleRemover = () => {
    if (!deleteId) return;
    const limite = limites.find((l) => l.id === deleteId);
    if (!limite) return;
    removerLimite.mutate(limite.categoriaNome, { onSuccess: () => setDeleteId(null) });
  };

  // Summary stats
  const okCount = limites.filter(l => l.status === "ok").length;
  const alertCount = limites.filter(l => l.status === "atencao" || l.status === "critico").length;
  const avgUse = limites.length > 0 ? Math.round(limites.reduce((s, l) => s + l.percentualConsumido, 0) / limites.length) : 0;

  return (
    <PageShell>
      {/* ── Page Header ── */}
      <PageHeader title="Limites por Categoria" description="Defina limites de gasto para manter o controle financeiro">
        <Button onClick={() => setShowForm(true)} className="gap-2 h-10 px-5 rounded-xl shadow-premium font-semibold" disabled={categoriasDisponiveis.length === 0}>
          <Plus className="h-4 w-4" />
          Definir Limite
        </Button>
      </PageHeader>

      {/* ── Stats Overview ── */}
      {loading ? (
        <CardSkeleton count={4} />
      ) : isError ? (
        <ErrorState message={error?.message} onRetry={() => refetch()} />
      ) : limites.length > 0 ? (
        <>
          <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Limites Ativos"
              value={limites.length}
              icon={<Gauge className="h-5 w-5" />}
              trend="neutral"
              delay={0}
            />
            <StatCard
              title="Dentro do Limite"
              value={okCount}
              icon={<Shield className="h-5 w-5" />}
              trend="up"
              delay={1}
            />
            <StatCard
              title="Em Alerta"
              value={alertCount}
              icon={<AlertTriangle className="h-5 w-5" />}
              trend={alertCount > 0 ? "down" : "neutral"}
              delay={2}
            />
            <StatCard
              title="Uso Médio"
              value={`${avgUse}%`}
              icon={<BarChart3 className="h-5 w-5" />}
              trend="neutral"
              delay={3}
            />
          </div>

          {/* ── Limits Grid ── */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence>
              {limites.map((l, i) => (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className="card-premium p-5 group transition-all hover:shadow-lg hover:-translate-y-0.5 duration-300"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${statusBgColor(l.status)} transition-transform duration-300 group-hover:scale-110`}>
                        {statusIcon(l.status)}
                      </div>
                      <div>
                        <h4 className="font-bold tracking-tight text-sm">{l.categoriaNome}</h4>
                        <Badge variant="secondary" className={`text-[10px] font-semibold mt-0.5 ${statusColor(l.status).badge}`}>
                          {statusLabel(l.status)}
                        </Badge>
                      </div>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all" onClick={() => setDeleteId(l.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remover limite</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  {/* Circular progress visual */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative h-16 w-16 shrink-0">
                      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/30" />
                        <circle
                          cx="32" cy="32" r="26" fill="none"
                          strokeWidth="5" strokeLinecap="round"
                          className={progressColor(l.status)}
                          stroke="currentColor"
                          strokeDasharray={`${Math.min(l.percentualConsumido, 100) * 1.634} 163.4`}
                          style={{ transition: "stroke-dasharray 1s ease-out" }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-extrabold tabular-nums">{l.percentualConsumido.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground/70 font-medium">Gasto</span>
                        <span className="font-bold tabular-nums">{formatCurrency(l.gastoAtual)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground/70 font-medium">Limite</span>
                        <span className="font-bold tabular-nums">{formatCurrency(l.valorLimite)}</span>
                      </div>
                      <Separator className="my-1" />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground/70 font-medium">Disponível</span>
                        <span className={`font-bold tabular-nums ${l.valorLimite - l.gastoAtual >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {formatCurrency(Math.max(l.valorLimite - l.gastoAtual, 0))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom progress bar */}
                  <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${progressColor(l.status)}`}
                      style={{ width: `${Math.min(l.percentualConsumido, 100)}%` }}
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      ) : (
        <EmptyState
          icon={<Gauge className="h-6 w-6" />}
          title="Nenhum limite definido"
          description="Defina limites de gasto por categoria para acompanhar seus gastos de forma visual"
          action={
            <Button onClick={() => setShowForm(true)} className="gap-2 shadow-premium">
              <Plus className="h-4 w-4" />Definir primeiro limite
            </Button>
          }
        />
      )}

      {/* ── New Limit Sheet ── */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="w-full sm:w-125 sm:max-w-125 overflow-hidden">
          {/* Accent line */}
          <div className="h-1 w-full shrink-0 bg-linear-to-r from-amber-400 via-orange-500 to-red-500" />

          {/* Header */}
          <SheetHeader className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 sm:pb-5">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-amber-500/10 text-amber-500 transition-all duration-500">
                <Gauge className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-lg sm:text-xl font-semibold">Definir Limite</SheetTitle>
                <SheetDescription className="text-muted-foreground text-xs sm:text-[13px] mt-0.5 truncate">Configure um limite de gasto para uma categoria</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <form onSubmit={handleSalvar} className="px-5 sm:px-7 pb-8 space-y-4 sm:space-y-5">
              {/* Main fields */}
              <div className="space-y-4 rounded-2xl border border-border/40 bg-muted/15 p-4 sm:p-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Categoria</Label>
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger className="h-11 rounded-xl border-border/40 bg-background focus:ring-1 focus:ring-primary/30">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriasDisponiveis.map((c) => (
                        <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {categoriasDisponiveis.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Todas as categorias já possuem limites definidos.</p>
                  )}
                </div>

                <div className="border-t border-border/20" />

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor Limite (R$)</Label>
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-11 sm:w-12 flex items-center justify-center rounded-l-xl text-sm font-bold bg-amber-500/10 text-amber-500">R$</div>
                    <Input placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} className="h-12 sm:h-14 rounded-xl pl-12 sm:pl-14 text-xl sm:text-2xl tabular-nums font-bold border-border/40 bg-background placeholder:text-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all" required />
                  </div>
                </div>
              </div>

              {/* Preview */}
              {categoria && valor && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border/40 bg-muted/15 p-4 sm:p-5 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Preview</p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/15">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm">{categoria}</p>
                      <p className="text-xs text-muted-foreground">Limite: {formatCurrency(parseFloat(valor.replace(",", ".")) || 0)}</p>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0">0%</Badge>
                  </div>
                </motion.div>
              )}

              {/* Submit */}
              <div className="pt-2 sm:pt-3 pb-safe">
                <Button
                  type="submit"
                  className="w-full h-12 sm:h-13 rounded-xl sm:rounded-2xl gap-2 sm:gap-2.5 font-semibold text-sm sm:text-[15px] bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 text-white transition-all duration-300 cursor-pointer active:scale-[0.98]"
                  disabled={definirLimite.isPending || !categoria}
                >
                  {definirLimite.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Gauge className="h-5 w-5" />
                      Salvar Limite
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Delete Dialog ── */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover limite?</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja remover este limite? Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemover} disabled={removerLimite.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl gap-2">
              {removerLimite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4" />Remover</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
