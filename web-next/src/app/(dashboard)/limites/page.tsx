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
  X,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";

function statusIcon(status: string) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "atencao":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "critico":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "excedido":
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return null;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "ok":
      return "Dentro do limite";
    case "atencao":
      return "Atenção";
    case "critico":
      return "Crítico";
    case "excedido":
      return "Excedido";
    default:
      return status;
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
    if (isNaN(valorNum) || valorNum <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    definirLimite.mutate(
      { categoria, valor: valorNum },
      {
        onSuccess: () => {
          setCategoria("");
          setValor("");
          setShowForm(false);
        },
      }
    );
  };

  const handleRemover = () => {
    if (!deleteId) return;
    const limite = limites.find((l) => l.id === deleteId);
    if (!limite) return;

    removerLimite.mutate(limite.categoriaNome, {
      onSuccess: () => setDeleteId(null),
    });
  };

  return (
    <PageShell>
      <PageHeader
        title="Limites por Categoria"
        description="Defina limites de gasto por categoria para manter o controle"
      >
        <Button
          onClick={() => setShowForm(!showForm)}
          className="gap-2"
          disabled={categoriasDisponiveis.length === 0}
        >
          {showForm ? (
            <>
              <X className="h-4 w-4" /> Cancelar
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> Definir Limite
            </>
          )}
        </Button>
      </PageHeader>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form
              onSubmit={handleSalvar}
              className="card-premium p-6 space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriasDisponiveis.map((c) => (
                        <SelectItem key={c.id} value={c.nome}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor Limite (R$)</Label>
                  <Input
                    placeholder="0,00"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="h-11 tabular-nums"
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={definirLimite.isPending || !categoria}
                className="gap-2"
              >
                {definirLimite.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Salvar Limite
                  </>
                )}
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Limits list */}
      {loading ? (
        <CardSkeleton count={3} />
      ) : isError ? (
        <ErrorState message={error?.message} onRetry={() => refetch()} />
      ) : limites.length > 0 ? (
        <div className="space-y-3">
          <AnimatePresence>
            {limites.map((l, i) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.05 }}
                className="card-premium p-5 transition-all hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    {statusIcon(l.status)}
                    <div>
                      <h4 className="font-bold tracking-tight">{l.categoriaNome}</h4>
                      <Badge variant="secondary" className={statusColor(l.status).badge}>
                        {statusLabel(l.status)}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(l.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Progress value={Math.min(l.percentualConsumido, 100)} className="h-2" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {formatCurrency(l.gastoAtual)} <span className="text-xs">de</span>{" "}
                      {formatCurrency(l.valorLimite)}
                    </span>
                    <span className="font-bold tabular-nums">
                      {l.percentualConsumido.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <EmptyState
          icon={<Gauge className="h-6 w-6" />}
          title="Nenhum limite definido"
          description="Defina limites de gasto por categoria para acompanhar seus gastos"
          action={
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Definir primeiro limite
            </Button>
          }
        />
      )}

      {/* Delete Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover limite</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este limite? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemover}
              disabled={removerLimite.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {removerLimite.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
