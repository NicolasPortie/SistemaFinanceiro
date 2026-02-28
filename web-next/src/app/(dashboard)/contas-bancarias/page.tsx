"use client";

import { useState, useMemo } from "react";
import {
  useContasBancarias,
  useCriarContaBancaria,
  useAtualizarContaBancaria,
  useDesativarContaBancaria,
} from "@/hooks/use-queries";
import { formatCurrency } from "@/lib/format";
import type { ContaBancaria, TipoContaBancaria } from "@/lib/api";
import {
  Landmark,
  Plus,
  Pencil,
  Trash2,
  Wallet,
  TrendingUp,
  PiggyBank,
  Smartphone,
  CreditCard,
  MoreVertical,
  Building2,
  CheckCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/components/shared/page-components";
import { motion, AnimatePresence } from "framer-motion";

// ── Helpers ───────────────────────────────────────────────

const TIPO_LABELS: Record<TipoContaBancaria, string> = {
  Corrente: "Conta Corrente",
  Poupanca: "Poupança",
  Investimento: "Investimento",
  Digital: "Conta Digital",
  Carteira: "Carteira",
  Outro: "Outro",
};

const TIPO_OPTIONS: TipoContaBancaria[] = [
  "Corrente",
  "Poupanca",
  "Investimento",
  "Digital",
  "Carteira",
  "Outro",
];

function getTipoInfo(tipo: TipoContaBancaria) {
  switch (tipo) {
    case "Corrente":
      return {
        icon: Building2,
        color: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      };
    case "Poupanca":
      return {
        icon: PiggyBank,
        color: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      };
    case "Investimento":
      return {
        icon: TrendingUp,
        color: "bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400",
      };
    case "Digital":
      return {
        icon: Smartphone,
        color: "bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400",
      };
    case "Carteira":
      return {
        icon: Wallet,
        color: "bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400",
      };
    default:
      return {
        icon: CreditCard,
        color: "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400",
      };
  }
}

// ── Formulário padrão ─────────────────────────────────────
interface FormState {
  nome: string;
  tipo: TipoContaBancaria;
  saldo: string;
}

const defaultForm: FormState = { nome: "", tipo: "Corrente", saldo: "" };

// ─────────────────────────────────────────────────────────
export default function ContasBancariasPage() {
  const { data: contas = [], isLoading, isError } = useContasBancarias();
  const criarConta = useCriarContaBancaria();
  const atualizarConta = useAtualizarContaBancaria();
  const desativarConta = useDesativarContaBancaria();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);

  // ── Stats ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalSaldo = contas.reduce((sum, c) => sum + c.saldo, 0);
    const maiorSaldo = contas.reduce<ContaBancaria | null>(
      (max, c) => (!max || c.saldo > max.saldo ? c : max),
      null
    );
    return { totalSaldo, totalContas: contas.length, maiorSaldo };
  }, [contas]);

  // ── Open create / edit ─────────────────────────────────
  function openCreate() {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(c: ContaBancaria) {
    setEditingId(c.id);
    setForm({ nome: c.nome, tipo: c.tipo, saldo: c.saldo.toFixed(2).replace(".", ",") });
    setDialogOpen(true);
  }

  // ── Submit ─────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const saldo = parseFloat(form.saldo.replace(",", ".")) || 0;

    if (editingId) {
      await atualizarConta.mutateAsync({
        id: editingId,
        data: { nome: form.nome, tipo: form.tipo, saldo },
      });
    } else {
      await criarConta.mutateAsync({ nome: form.nome, tipo: form.tipo, saldo });
    }
    setDialogOpen(false);
    setForm(defaultForm);
    setEditingId(null);
  }

  async function handleDesativar() {
    if (!deleteId) return;
    await desativarConta.mutateAsync(deleteId);
    setDeleteId(null);
  }

  const isSubmitting = criarConta.isPending || atualizarConta.isPending;

  if (isError) return <ErrorState message="Não foi possível carregar as contas." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-2xl p-4 lg:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="size-10 flex items-center justify-center bg-emerald-600/10 rounded-xl">
            <Landmark className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
              Contas Bancárias
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Gerencie suas contas e carteiras
            </p>
          </div>
        </div>
        <Button
          onClick={openCreate}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/20"
        >
          <Plus className="h-4 w-4" />
          Nova Conta
        </Button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="glass-panel rounded-2xl p-5 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300"
        >
          <div className="absolute -right-6 -bottom-6 bg-emerald-500/10 w-28 h-28 rounded-full blur-2xl group-hover:bg-emerald-500/15 transition-all" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 relative z-10">
            Saldo Total
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums relative z-10">
            {isLoading ? "—" : formatCurrency(stats.totalSaldo)}
          </p>
          <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-1 relative z-10">
            em {stats.totalContas} conta{stats.totalContas !== 1 ? "s" : ""}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-panel rounded-2xl p-5 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300"
        >
          <div className="absolute -right-6 -bottom-6 bg-emerald-500/10 w-28 h-28 rounded-full blur-2xl group-hover:bg-emerald-500/15 transition-all" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 relative z-10">
            Contas Ativas
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 relative z-10">
            {isLoading ? "—" : stats.totalContas}
          </p>
          <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-1 relative z-10">
            registradas no sistema
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel rounded-2xl p-5 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-300"
        >
          <div className="absolute -right-6 -bottom-6 bg-emerald-500/10 w-28 h-28 rounded-full blur-2xl group-hover:bg-emerald-500/15 transition-all" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 relative z-10">
            Maior Saldo
          </p>
          {isLoading || !stats.maiorSaldo ? (
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 relative z-10">—</p>
          ) : (
            <>
              <p className="text-[15px] font-bold text-slate-900 dark:text-white mt-1 truncate relative z-10">
                {stats.maiorSaldo.nome}
              </p>
              <p className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums relative z-10">
                {formatCurrency(stats.maiorSaldo.saldo)}
              </p>
            </>
          )}
        </motion.div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Carregando...</div>
        ) : contas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="h-14 w-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center mb-4">
              <Landmark className="h-7 w-7 text-emerald-600" />
            </div>
            <p className="text-[15px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nenhuma conta cadastrada
            </p>
            <p className="text-[13px] text-slate-400 dark:text-slate-500 mb-4">
              Adicione suas contas bancárias para vincular aos lançamentos
            </p>
            <Button
              onClick={openCreate}
              size="sm"
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
            >
              <Plus className="h-3.5 w-3.5" /> Nova Conta
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop header */}
            <div
              className="hidden lg:grid items-center px-5 py-3 border-b border-emerald-600/8 bg-emerald-600/3 dark:border-slate-700/40 dark:bg-slate-800/30"
              style={{ gridTemplateColumns: "2fr 1.5fr 1.2fr 80px" }}
            >
              {["CONTA", "TIPO", "SALDO", "AÇÕES"].map((h) => (
                <span
                  key={h}
                  className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500"
                >
                  {h}
                </span>
              ))}
            </div>

            <div className="divide-y divide-slate-100/60 dark:divide-slate-800/60">
              {contas.map((c) => {
                const tipoInfo = getTipoInfo(c.tipo);
                const TipoIcon = tipoInfo.icon;
                return (
                  <div key={c.id}>
                    {/* Desktop row */}
                    <div
                      className="hidden lg:grid items-center px-5 py-4 hover:bg-white/40 dark:hover:bg-slate-800/20 transition-colors"
                      style={{ gridTemplateColumns: "2fr 1.5fr 1.2fr 80px" }}
                    >
                      {/* Conta */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                            tipoInfo.color
                          )}
                        >
                          <TipoIcon className="h-4 w-4" />
                        </div>
                        <p className="text-[14px] font-semibold text-slate-800 dark:text-white truncate">
                          {c.nome}
                        </p>
                      </div>

                      {/* Tipo */}
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-600 dark:text-slate-300">
                        <TipoIcon className="h-3 w-3 opacity-60" />
                        {TIPO_LABELS[c.tipo]}
                      </span>

                      {/* Saldo */}
                      <span
                        className={cn(
                          "text-[14px] font-bold tabular-nums",
                          c.saldo >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-500 dark:text-red-400"
                        )}
                      >
                        {formatCurrency(c.saldo)}
                      </span>

                      {/* Ações */}
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(c.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div className="lg:hidden flex items-center gap-3 px-4 py-3.5 hover:bg-white/40 dark:hover:bg-slate-800/20 transition-colors">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                          tipoInfo.color
                        )}
                      >
                        <TipoIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-slate-800 dark:text-white truncate">
                          {c.nome}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          {TIPO_LABELS[c.tipo]}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={cn(
                            "text-[13px] font-bold tabular-nums",
                            c.saldo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
                          )}
                        >
                          {formatCurrency(c.saldo)}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                              <MoreVertical className="h-4 w-4 text-slate-400" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openEdit(c)}
                              className="gap-2 cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteId(c.id)}
                              className="gap-2 text-red-600 dark:text-red-400 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Dialog: criar / editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">


          <DialogHeader>
            <div className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-emerald-600/8 bg-emerald-600/3 p-3.5 sm:p-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-emerald-600/15 text-emerald-600 shadow-sm shadow-emerald-500/10">
                <Landmark className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-semibold">
                  {editingId ? "Editar Conta" : "Nova Conta Bancária"}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs sm:text-[13px] mt-0.5">
                  {editingId
                    ? "Atualize os dados da sua conta bancária."
                    : "Adicione uma conta bancária ou carteira"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div>
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              {/* Main fields card */}
              <div className="space-y-4 rounded-2xl border border-emerald-600/8 dark:border-slate-700/40 bg-white dark:bg-slate-800/60 shadow-[0_1px_6px_rgba(16,185,129,0.06)] dark:shadow-none p-4 sm:p-5">
                {/* Nome */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Nome da Conta
                  </Label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
                    <Input
                      placeholder="Ex: Nubank, Bradesco Corrente..."
                      value={form.nome}
                      onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                      required
                      className="h-11 rounded-xl pl-10 border-border/40 bg-background placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all"
                    />
                  </div>
                </div>

                <div className="border-t border-border/20" />

                {/* Tipo */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Tipo de Conta
                  </Label>
                  <Select
                    value={form.tipo}
                    onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as TipoContaBancaria }))}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-border/40 bg-background focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-all">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_OPTIONS.map((t) => {
                        const tipoInfo = getTipoInfo(t);
                        const TipoIcon = tipoInfo.icon;
                        return (
                          <SelectItem key={t} value={t}>
                            <div className="flex items-center gap-2">
                              <TipoIcon className="h-3.5 w-3.5 opacity-60" />
                              {TIPO_LABELS[t]}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Saldo card */}
              <div className="space-y-4 rounded-2xl border border-emerald-600/8 dark:border-slate-700/40 bg-white dark:bg-slate-800/60 shadow-[0_1px_6px_rgba(16,185,129,0.06)] dark:shadow-none p-4 sm:p-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Saldo Atual (R$)
                  </Label>
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-11 sm:w-12 flex items-center justify-center rounded-l-xl text-sm font-bold bg-emerald-600/10 text-emerald-600">
                      R$
                    </div>
                    <CurrencyInput
                      placeholder="0,00"
                      value={form.saldo}
                      onValueChange={(v) => setForm((f) => ({ ...f, saldo: v }))}
                      className="h-12 sm:h-14 rounded-xl pl-12 sm:pl-14 text-xl sm:text-2xl tabular-nums font-bold border-border/40 bg-background placeholder:text-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Info card */}
              <div className="rounded-2xl border border-emerald-600/8 bg-emerald-600/3 p-4 sm:p-5">
                <p className="text-xs text-muted-foreground flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 shrink-0 text-emerald-600/50 mt-0.5" />
                  <span>
                    <strong>Dica:</strong> O saldo inicial será usado como ponto de partida para
                    calcular o saldo atual baseado nos seus lançamentos.
                  </span>
                </p>
              </div>

              {/* Submit */}
              <div className="pt-2 sm:pt-3 pb-safe">
                <Button
                  type="submit"
                  disabled={isSubmitting || !form.nome.trim()}
                  className="w-full h-12 sm:h-13 rounded-xl sm:rounded-2xl gap-2 sm:gap-2.5 font-semibold text-sm sm:text-[15px] bg-emerald-600 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 text-white transition-all duration-300 cursor-pointer active:scale-[0.98]"
                  loading={isSubmitting}
                >
                  <CheckCircle className="h-5 w-5" />
                  {editingId ? "Salvar Alterações" : "Criar Conta"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: desativar */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="dark:bg-slate-900 dark:border-slate-700/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-white">
              Remover conta?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 dark:text-slate-400">
              A conta será desativada e não aparecerá mais na lista. Os lançamentos vinculados não
              serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDesativar}
              loading={desativarConta.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
