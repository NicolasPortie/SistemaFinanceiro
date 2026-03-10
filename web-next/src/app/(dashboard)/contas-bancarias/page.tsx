"use client";

import Image from "next/image";
import { useState, useMemo } from "react";
import {
  useContasBancarias,
  useCriarContaBancaria,
  useAtualizarContaBancaria,
  useDesativarContaBancaria,
} from "@/hooks/use-queries";
import { formatCurrency } from "@/lib/format";
import type { ContaBancaria, TipoContaBancaria } from "@/lib/api";
import { SUPPORTED_BANKS, getBankById } from "@/lib/banks";
import {
  Landmark,
  Plus,
  Trash2,
  Wallet,
  TrendingUp,
  PiggyBank,
  Smartphone,
  CreditCard,
  Building2,
  CheckCircle,
  Info,
  Sparkles,
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
import { cn } from "@/lib/utils";
import { ErrorState } from "@/components/shared/page-components";
import { DialogShellHeader } from "@/components/shared/dialog-shell";

// ── Colors for balance distribution bars ────────────────
const DIST_COLORS = [
  "bg-purple-600",
  "bg-orange-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-violet-600",
  "bg-amber-500",
  "bg-sky-500",
];

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
  instituicao: string;
  saldo: string;
}

const defaultForm: FormState = { nome: "", tipo: "Corrente", instituicao: "", saldo: "" };

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
    const totalInvestimentos = contas
      .filter((c) => c.tipo === "Investimento")
      .reduce((sum, c) => sum + c.saldo, 0);
    const totalCorrente = contas
      .filter((c) => c.tipo === "Corrente" || c.tipo === "Digital")
      .reduce((sum, c) => sum + c.saldo, 0);
    const pctInvestimentos =
      totalSaldo > 0 ? Math.round((totalInvestimentos / totalSaldo) * 100) : 0;
    const distribution = contas.map((c, i) => ({
      id: c.id,
      nome: c.nome,
      pct: totalSaldo > 0 ? Math.round((Math.max(c.saldo, 0) / totalSaldo) * 100) : 0,
      color: DIST_COLORS[i % DIST_COLORS.length],
    }));
    return {
      totalSaldo,
      totalContas: contas.length,
      totalInvestimentos,
      totalCorrente,
      pctInvestimentos,
      distribution,
    };
  }, [contas]);

  // ── Open create / edit ─────────────────────────────────
  function openCreate() {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(c: ContaBancaria) {
    setEditingId(c.id);
    setForm({
      nome: c.nome,
      tipo: c.tipo,
      instituicao: c.instituicao || "",
      saldo: c.saldo.toFixed(2).replace(".", ","),
    });
    setDialogOpen(true);
  }

  // ── Submit ─────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const saldo = parseFloat(form.saldo.replace(",", ".")) || 0;

    if (editingId) {
      await atualizarConta.mutateAsync({
        id: editingId,
        data: { nome: form.nome, tipo: form.tipo, instituicao: form.instituicao || null, saldo },
      });
    } else {
      await criarConta.mutateAsync({
        nome: form.nome,
        tipo: form.tipo,
        instituicao: form.instituicao || undefined,
        saldo,
      });
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
    <div className="flex flex-col gap-5 sm:gap-8">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl serif-italic text-slate-900 dark:text-white">
            Contas Bancárias
          </h1>
          <p className="text-[11px] text-slate-400 font-medium uppercase tracking-[0.2em]">
            Saldos de Referência para Débito e PIX
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-emerald-600 text-white px-5 sm:px-8 py-3 sm:py-4 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/25 dark:shadow-emerald-500/20 cursor-pointer w-full sm:w-auto justify-center"
        >
          <Plus className="h-5 w-5" />
          Adicionar Conta
        </button>
      </div>

      {/* ── Stat cards ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {/* Saldo Consolidado */}
        <div className="exec-card p-5 sm:p-8 lg:p-10 rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] flex flex-col justify-between min-h-[140px] sm:min-h-[180px]">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em]">
            Saldo Consolidado
          </p>
          <div className="flex flex-col">
            <span className="text-xl sm:text-2xl lg:text-3xl serif-italic text-slate-900 dark:text-white whitespace-nowrap">
              {isLoading ? "—" : formatCurrency(stats.totalSaldo)}
            </span>
            <span className="text-[10px] mono-data text-emerald-600 font-bold mt-2">
              {stats.totalContas} conta{stats.totalContas !== 1 ? "s" : ""} ativas
            </span>
          </div>
        </div>

        {/* Total em Investimentos */}
        <div className="exec-card p-5 sm:p-8 lg:p-10 rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] flex flex-col justify-between min-h-[140px] sm:min-h-[180px]">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em]">
            Total em Investimentos
          </p>
          <div className="flex flex-col">
            <span className="text-xl sm:text-2xl lg:text-3xl serif-italic text-slate-900 dark:text-white whitespace-nowrap">
              {isLoading ? "—" : formatCurrency(stats.totalInvestimentos)}
            </span>
            <span className="text-[10px] mono-data text-slate-400 font-medium mt-2">
              {isLoading ? "" : `${stats.pctInvestimentos}% do patrimônio`}
            </span>
          </div>
        </div>

        {/* Disponível em Conta Corrente */}
        <div className="exec-card p-5 sm:p-8 lg:p-10 rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] flex flex-col justify-between min-h-[140px] sm:min-h-[180px]">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em]">
            Disponível em Conta Corrente
          </p>
          <div className="flex flex-col">
            <span className="text-xl sm:text-2xl lg:text-3xl serif-italic text-emerald-600 whitespace-nowrap">
              {isLoading ? "—" : formatCurrency(stats.totalCorrente)}
            </span>
            <span className="text-[10px] mono-data text-slate-400 font-medium mt-2">
              Liquidez imediata
            </span>
          </div>
        </div>
      </div>

      {/* ── Account cards ─────────────────────────────────── */}
      <div className="space-y-6">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] px-2">
          Suas Instituições
        </h4>

        {isLoading ? (
          <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-5 sm:p-8 text-center text-slate-400">
            Carregando...
          </div>
        ) : contas.length === 0 ? (
          <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-500/15">
              <Landmark className="h-7 w-7 text-emerald-600 dark:text-emerald-300" />
            </div>
            <p className="mb-1 text-[15px] font-semibold text-slate-700 dark:text-white">
              Nenhuma conta cadastrada
            </p>
            <p className="mb-4 text-[13px] text-slate-400 dark:text-slate-400">
              Adicione suas contas bancárias para vincular aos lançamentos
            </p>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2 text-sm font-semibold cursor-pointer transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Nova Conta
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {contas.map((c) => {
              const tipoInfo = getTipoInfo(c.tipo);
              const TipoIcon = tipoInfo.icon;
              const bank = c.instituicao ? getBankById(c.instituicao) : undefined;
              const initials = c.nome.slice(0, 2).toUpperCase();
              const isNegative = c.saldo < 0;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "exec-card p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] flex flex-col gap-4 sm:gap-6",
                    isNegative && "border-l-4 border-l-rose-500"
                  )}
                >
                  {/* Institution header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      {bank?.logoUrl ? (
                        <Image
                          src={bank.logoUrl}
                          alt={bank.name}
                          width={56}
                          height={56}
                          className="w-14 h-14 rounded-2xl object-cover border border-slate-100 dark:border-slate-800"
                        />
                      ) : (
                        <div
                          className={cn(
                            "w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg tracking-tighter",
                            tipoInfo.color
                          )}
                        >
                          {initials}
                        </div>
                      )}
                      <div>
                        <h3 className="max-w-[140px] truncate text-sm font-bold text-slate-900 dark:text-white">
                          {c.nome}
                        </h3>
                        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-medium">
                          {TIPO_LABELS[c.tipo]}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-xl ml-auto",
                          tipoInfo.color
                        )}
                      >
                        <TipoIcon className="h-4 w-4" />
                      </div>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="space-y-1">
                    <p className="text-[8px] text-slate-400 uppercase tracking-[0.2em]">
                      Saldo Disponível
                    </p>
                    <p
                      className={cn(
                        "text-2xl mono-data font-bold",
                        isNegative ? "text-rose-500" : "text-slate-900 dark:text-white"
                      )}
                    >
                      {formatCurrency(c.saldo)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={() => openEdit(c)}
                      aria-label={`Ver detalhes da conta ${c.nome}`}
                      className="flex-1 py-3 px-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-300 transition-all cursor-pointer"
                    >
                      Ver Detalhes
                    </button>
                    <button
                      onClick={() => setDeleteId(c.id)}
                      aria-label={`Remover conta ${c.nome}`}
                      className="w-12 h-11 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-rose-500 dark:hover:text-rose-200 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Bottom section: Distribution + Insights ───────── */}
      {!isLoading && contas.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 pb-12">
          {/* Distribuição de Saldo */}
          <div className="exec-card p-5 sm:p-8 lg:p-10 rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem]">
            <h4 className="mb-8 text-[9px] font-bold uppercase tracking-[0.3em] text-slate-900 dark:text-white">
              Distribuição de Saldo
            </h4>
            <div className="space-y-6">
              {stats.distribution.map((item) => (
                <div key={item.id}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <span
                        className={cn("w-2 h-2 rounded-full", item.color.replace("bg-", "bg-"))}
                      />
                      {item.nome}
                    </span>
                    <span className="text-[11px] mono-data font-bold">{item.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800/80">
                    <div
                      className={cn("h-full rounded-full transition-all", item.color)}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Insights */}
          <div className="exec-card p-5 sm:p-8 lg:p-10 rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] bg-slate-900 text-white border-none flex flex-col justify-between">
            <div>
              <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                Insights Financeiros
              </h4>
              <p className="serif-italic text-lg text-slate-200 leading-relaxed">
                {stats.totalInvestimentos > 0
                  ? `Seu patrimônio em investimentos representa `
                  : `Você possui `}
                <span className="text-emerald-400">
                  {stats.totalContas} conta{stats.totalContas !== 1 ? "s" : ""} ativa
                  {stats.totalContas !== 1 ? "s" : ""}
                </span>
                {stats.totalInvestimentos > 0
                  ? ` com ${stats.pctInvestimentos}% alocados em investimentos. Seu saldo consolidado é de `
                  : ` com saldo consolidado de `}
                <span className="text-emerald-400">{formatCurrency(stats.totalSaldo)}</span>
                {stats.totalCorrente > 0
                  ? ` sendo ${formatCurrency(stats.totalCorrente)} disponíveis imediatamente.`
                  : "."}
              </p>
            </div>
            <button
              onClick={openCreate}
              className="mt-8 py-4 rounded-2xl bg-emerald-600 w-full text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all cursor-pointer"
            >
              Adicionar Nova Conta
            </button>
          </div>
        </div>
      )}

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

                {/* Instituicao */}
                <div className="space-y-1.5 mt-4">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Instituição (Opcional)
                  </Label>
                  <Select
                    value={form.instituicao || "none"}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, instituicao: v === "none" ? "" : v }))
                    }
                  >
                    <SelectTrigger className="h-11 rounded-xl border-border/40 bg-background focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-all">
                      <SelectValue placeholder="Selecione um banco..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma / Outra</SelectItem>
                      {SUPPORTED_BANKS.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
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
        <AlertDialogContent>
          <AlertDialogHeader className="items-start text-left">
            <AlertDialogTitle className="sr-only">Remover conta?</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              A conta será desativada e não aparecerá mais na lista. Os lançamentos vinculados não
              serão afetados.
            </AlertDialogDescription>
            <DialogShellHeader
              icon={<Trash2 className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Remover conta?"
              description="A conta será desativada e não aparecerá mais na lista. Os lançamentos vinculados não serão afetados."
              tone="rose"
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
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
