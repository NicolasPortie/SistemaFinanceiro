"use client";

import { useState } from "react";
import {
  useLembretes,
  useCriarLembrete,
  useAtualizarLembrete,
  useDesativarLembrete,
} from "@/hooks/use-queries";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarClock,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  Loader2,
  X,
  Repeat,
  CalendarDays,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import {
  PageShell,
  PageHeader,
  EmptyState,
  CardSkeleton,
  ErrorState,
} from "@/components/shared/page-components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { LembretePagamento } from "@/lib/api";

export default function ContasFixasPage() {
  const { data: lembretes = [], isLoading, isError, error, refetch } = useLembretes();
  const criarLembrete = useCriarLembrete();
  const atualizarLembrete = useAtualizarLembrete();
  const desativarLembrete = useDesativarLembrete();

  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<LembretePagamento | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Form state
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [diaRecorrente, setDiaRecorrente] = useState("");

  const resetForm = () => {
    setDescricao("");
    setValor("");
    setDataVencimento("");
    setRecorrente(false);
    setDiaRecorrente("");
    setShowForm(false);
    setEditItem(null);
  };

  const openEdit = (lembrete: LembretePagamento) => {
    setEditItem(lembrete);
    setDescricao(lembrete.descricao);
    setValor(lembrete.valor?.toString() ?? "");
    setDataVencimento(lembrete.dataVencimento);
    setRecorrente(lembrete.recorrenteMensal);
    setDiaRecorrente(lembrete.diaRecorrente?.toString() ?? "");
  };

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim()) {
      toast.error("Informe a descrição");
      return;
    }
    if (!dataVencimento) {
      toast.error("Informe a data de vencimento");
      return;
    }

    const valorNum = valor ? parseFloat(valor.replace(",", ".")) : undefined;

    criarLembrete.mutate(
      {
        descricao: descricao.trim(),
        valor: valorNum,
        dataVencimento,
        recorrenteMensal: recorrente,
        diaRecorrente: recorrente && diaRecorrente ? parseInt(diaRecorrente) : undefined,
      },
      { onSuccess: resetForm }
    );
  };

  const handleAtualizar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;

    const valorNum = valor ? parseFloat(valor.replace(",", ".")) : undefined;

    atualizarLembrete.mutate(
      {
        id: editItem.id,
        data: {
          descricao: descricao.trim() || undefined,
          valor: valorNum,
          dataVencimento: dataVencimento || undefined,
          recorrenteMensal: recorrente,
          diaRecorrente: recorrente && diaRecorrente ? parseInt(diaRecorrente) : undefined,
        },
      },
      { onSuccess: resetForm }
    );
  };

  const handleDesativar = () => {
    if (!deleteId) return;
    desativarLembrete.mutate(deleteId, {
      onSuccess: () => setDeleteId(null),
    });
  };

  const isVencido = (dataVenc: string) => {
    return new Date(dataVenc) < new Date(new Date().toISOString().split("T")[0]);
  };

  const isProximo = (dataVenc: string) => {
    const diff = new Date(dataVenc).getTime() - new Date(new Date().toISOString().split("T")[0]).getTime();
    return diff >= 0 && diff <= 3 * 24 * 60 * 60 * 1000; // 3 days
  };

  return (
    <PageShell>
      <PageHeader
        title="Contas Fixas"
        description="Gerencie seus lembretes de pagamento e contas recorrentes"
      >
        <Button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="gap-2"
        >
          {showForm ? (
            <>
              <X className="h-4 w-4" /> Cancelar
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> Novo Lembrete
            </>
          )}
        </Button>
      </PageHeader>

      {/* Create Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleCriar} className="card-premium p-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    placeholder="Ex: Aluguel, Internet, Energia..."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    className="h-11"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input
                    placeholder="0,00 (opcional)"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="h-11 tabular-nums"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 items-end">
                <div className="space-y-2">
                  <Label>Data de Vencimento</Label>
                  <Input
                    type="date"
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                    className="h-11"
                    required
                  />
                </div>
                <div className="flex items-center gap-3 h-11">
                  <Switch
                    checked={recorrente}
                    onCheckedChange={setRecorrente}
                  />
                  <Label className="cursor-pointer">Recorrente mensal</Label>
                </div>
              </div>

              {recorrente && (
                <div className="space-y-2 sm:w-1/2">
                  <Label>Dia de vencimento (1-31)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    placeholder="Dia"
                    value={diaRecorrente}
                    onChange={(e) => setDiaRecorrente(e.target.value)}
                    className="h-11"
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={criarLembrete.isPending}
                className="gap-2"
              >
                {criarLembrete.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Criar Lembrete
                  </>
                )}
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lembretes list */}
      {isLoading ? (
        <CardSkeleton count={3} />
      ) : isError ? (
        <ErrorState message={error?.message} onRetry={() => refetch()} />
      ) : lembretes.length > 0 ? (
        <div className="space-y-3">
          <AnimatePresence>
            {lembretes.map((l, i) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.05 }}
                className="card-premium p-5 transition-all hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${
                      isVencido(l.dataVencimento)
                        ? "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"
                        : isProximo(l.dataVencimento)
                        ? "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
                        : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
                    }`}>
                      {isVencido(l.dataVencimento) ? (
                        <AlertCircle className="h-5 w-5" />
                      ) : (
                        <CalendarClock className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold tracking-tight truncate">{l.descricao}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {l.valor != null && (
                          <Badge variant="secondary" className="gap-1 font-semibold tabular-nums">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(l.valor)}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`gap-1 ${
                            isVencido(l.dataVencimento)
                              ? "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400"
                              : isProximo(l.dataVencimento)
                              ? "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
                              : ""
                          }`}
                        >
                          <CalendarDays className="h-3 w-3" />
                          {formatShortDate(l.dataVencimento)}
                          {isVencido(l.dataVencimento) && " (vencido)"}
                        </Badge>
                        {l.recorrenteMensal && (
                          <Badge variant="secondary" className="gap-1">
                            <Repeat className="h-3 w-3" />
                            {l.diaRecorrente ? `Dia ${l.diaRecorrente}` : "Mensal"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-primary"
                      onClick={() => openEdit(l)}
                      aria-label="Editar lembrete"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteId(l.id)}
                      aria-label="Desativar lembrete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <EmptyState
          icon={<CalendarClock className="h-6 w-6" />}
          title="Nenhum lembrete cadastrado"
          description="Adicione contas fixas e lembretes de pagamento para manter o controle"
          action={
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar primeiro lembrete
            </Button>
          }
        />
      )}

      {/* Edit Dialog */}
      <Dialog open={editItem !== null} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Lembrete</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAtualizar} className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="h-11 tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Vencimento</Label>
              <Input
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={recorrente}
                onCheckedChange={setRecorrente}
              />
              <Label className="cursor-pointer">Recorrente mensal</Label>
            </div>
            {recorrente && (
              <div className="space-y-2">
                <Label>Dia de vencimento (1-31)</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={diaRecorrente}
                  onChange={(e) => setDiaRecorrente(e.target.value)}
                  className="h-11"
                />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={atualizarLembrete.isPending} className="gap-2">
                {atualizarLembrete.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Salvar
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar lembrete</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar este lembrete? Ele não aparecerá mais na lista.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDesativar}
              disabled={desativarLembrete.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {desativarLembrete.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
