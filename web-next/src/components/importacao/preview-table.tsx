"use client";

import { useState, useMemo, useCallback } from "react";

import {
  Check,
  AlertTriangle,
  Copy,
  Ban,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  CheckCircle2,
  CreditCard,
  Loader2,
  Pencil,
  X,
  ShieldAlert,
  Eye,
  EyeOff,
  Filter,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { useCategorias } from "@/hooks/use-queries";
import type {
  ImportacaoPreview,
  TransacaoImportada,
  TransacaoOverride,
  StatusTransacaoImportada,
  TipoTransacao,
} from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

/* ── Status visual config ── */
const STATUS_CONFIG: Record<
  StatusTransacaoImportada,
  { label: string; color: string; bgRow: string; icon: React.ElementType; description: string }
> = {
  Normal: {
    label: "Normal",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
    bgRow: "",
    icon: Check,
    description: "Transação válida e pronta para importar",
  },
  Suspeita: {
    label: "Suspeita",
    color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
    bgRow: "bg-amber-50/40 dark:bg-amber-950/10",
    icon: AlertTriangle,
    description: "Transação com dados que podem precisar de revisão",
  },
  Duplicata: {
    label: "Duplicata",
    color: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
    bgRow: "bg-orange-50/40 dark:bg-orange-950/10",
    icon: Copy,
    description: "Já existe um lançamento igual ou muito similar",
  },
  Ignorada: {
    label: "Ignorada",
    color: "bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-neutral-800/30 dark:text-neutral-400 dark:border-neutral-700",
    bgRow: "bg-neutral-50/60 dark:bg-neutral-900/20",
    icon: Ban,
    description: "Transação excluída automaticamente (ex: pagamento de fatura)",
  },
};

const TIPO_LABEL: Record<TipoTransacao, { label: string; color: string }> = {
  Debito: { label: "Débito", color: "text-red-600 dark:text-red-400" },
  Credito: { label: "Crédito", color: "text-emerald-600 dark:text-emerald-400" },
  Indefinido: { label: "—", color: "text-muted-foreground" },
};

type SortField = "data" | "valor" | "descricao" | "status";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | StatusTransacaoImportada;

interface PreviewTableProps {
  preview: ImportacaoPreview;
  onConfirm: (indicesSelecionados: number[], overrides: TransacaoOverride[]) => void;
  onCancel: () => void;
  isConfirming: boolean;
}

export function PreviewTable({ preview, onConfirm, onCancel, isConfirming }: PreviewTableProps) {
  const { data: categorias } = useCategorias();
  const categoriasLista = useMemo(() => categorias ?? [], [categorias]);

  // Selection state
  const [selected, setSelected] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    preview.transacoes.forEach((t) => {
      if (t.selecionada && t.status !== "Ignorada" && t.status !== "Duplicata") initial.add(t.indiceOriginal);
    });
    return initial;
  });

  // Overrides state
  const [overrides, setOverrides] = useState<Map<number, TransacaoOverride>>(new Map());
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<TransacaoOverride>>({});

  // Sort state
  const [sortField, setSortField] = useState<SortField>("data");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Month grouping collapse
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  // Status filter
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Show/hide duplicates toggle
  const [showDuplicatas, setShowDuplicatas] = useState(true);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // Apply overrides to transactions for display
  const getDisplayTransaction = useCallback(
    (t: TransacaoImportada) => {
      const override = overrides.get(t.indiceOriginal);
      return {
        ...t,
        data: override?.data ?? t.data,
        descricao: override?.descricao ?? t.descricao,
        valor: override?.valor ?? t.valor,
        categoriaId: override?.categoriaId ?? t.categoriaId,
        categoriaSugerida:
          override?.categoria ?? override?.categoriaId
            ? categoriasLista.find((c) => c.id === (override?.categoriaId ?? t.categoriaId))?.nome ?? t.categoriaSugerida
            : t.categoriaSugerida,
      };
    },
    [overrides, categoriasLista]
  );

  // Sort, filter and group by month
  const sortedTransactions = useMemo(() => {
    let items = preview.transacoes.map(getDisplayTransaction);

    // Apply status filter
    if (statusFilter !== "all") {
      items = items.filter((t) => t.status === statusFilter);
    } else if (!showDuplicatas) {
      items = items.filter((t) => t.status !== "Duplicata");
    }

    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "data":
          cmp = new Date(a.data).getTime() - new Date(b.data).getTime();
          break;
        case "valor":
          cmp = a.valor - b.valor;
          break;
        case "descricao":
          cmp = a.descricao.localeCompare(b.descricao);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return items;
  }, [preview.transacoes, sortField, sortDir, getDisplayTransaction, statusFilter, showDuplicatas]);

  // Group by month
  const groupedByMonth = useMemo(() => {
    const groups = new Map<string, TransacaoImportada[]>();
    for (const t of sortedTransactions) {
      const d = new Date(t.data);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    return groups;
  }, [sortedTransactions]);

  // Stats
  const totalNormais = preview.transacoes.filter((t) => t.status === "Normal").length;
  const totalDuplicatas = preview.totalDuplicatas;
  const totalIgnoradas = preview.totalIgnoradas;
  const semCategoria = preview.transacoes.filter(
    (t) => selected.has(t.indiceOriginal) && !overrides.get(t.indiceOriginal)?.categoriaId && !t.categoriaId
  ).length;
  const valorTotalSelecionado = preview.transacoes
    .filter((t) => selected.has(t.indiceOriginal))
    .reduce((sum, t) => sum + Math.abs(overrides.get(t.indiceOriginal)?.valor ?? t.valor), 0);

  const toggleSelectAll = () => {
    const selectable = preview.transacoes.filter((t) => t.status !== "Ignorada" && t.status !== "Duplicata");
    if (selected.size === selectable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectable.map((t) => t.indiceOriginal)));
    }
  };

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleMonth = (month: string) => {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  const startEdit = (t: TransacaoImportada) => {
    setEditingRow(t.indiceOriginal);
    const override = overrides.get(t.indiceOriginal);
    setEditForm({
      data: override?.data ?? t.data,
      descricao: override?.descricao ?? t.descricao,
      valor: override?.valor ?? t.valor,
      categoriaId: override?.categoriaId ?? t.categoriaId ?? undefined,
    });
  };

  const saveEdit = () => {
    if (editingRow === null) return;
    const original = preview.transacoes.find((t) => t.indiceOriginal === editingRow);
    if (!original) return;

    const ov: TransacaoOverride = { indiceOriginal: editingRow };
    if (editForm.data && editForm.data !== original.data) ov.data = editForm.data;
    if (editForm.descricao && editForm.descricao !== original.descricao) ov.descricao = editForm.descricao;
    if (editForm.valor !== undefined && editForm.valor !== original.valor) ov.valor = editForm.valor;
    if (editForm.categoriaId && editForm.categoriaId !== original.categoriaId) {
      ov.categoriaId = editForm.categoriaId;
      ov.categoria = categoriasLista.find((c) => c.id === editForm.categoriaId)?.nome;
    }

    // Only save if there are actual changes
    if (Object.keys(ov).length > 1) {
      setOverrides((prev) => new Map(prev).set(editingRow, ov));
    }
    setEditingRow(null);
    setEditForm({});
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setEditForm({});
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selected), Array.from(overrides.values()));
  };

  const selectableCount = preview.transacoes.filter((t) => t.status !== "Ignorada" && t.status !== "Duplicata").length;
  const allSelected = selected.size === selectableCount && selectableCount > 0;
  const allDuplicatas = totalDuplicatas === preview.totalTransacoes && totalDuplicatas > 0;

  // Filter avisos that duplicate the "already imported" info
  const filteredAvisos = useMemo(() => {
    if (!preview.arquivoJaImportado) return preview.avisos;
    return preview.avisos.filter(a => !a.toLowerCase().includes("já foi importado"));
  }, [preview.avisos, preview.arquivoJaImportado]);

  const formatMonthLabel = (key: string) => {
    const [y, m] = key.split("-");
    const d = new Date(parseInt(y), parseInt(m) - 1, 1);
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
    >
      {children}
      {sortField === field ? (
        sortDir === "asc" ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-30" />
      )}
    </button>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">

        {/* ── Fatura banner ── */}
        {preview.tipoImportacao === "Fatura" && preview.cartaoCreditoNome && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-xl border border-violet-200 bg-linear-to-r from-violet-50 to-violet-50/50 dark:border-violet-800 dark:from-violet-950/40 dark:to-violet-950/20 p-4"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/50">
              <CreditCard className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="text-sm">
              <p className="font-medium text-violet-900 dark:text-violet-200">
                Fatura do cartão <span className="font-semibold">{preview.cartaoCreditoNome}</span>
              </p>
              {preview.mesesDetectados.length > 0 && (
                <p className="text-violet-600/80 dark:text-violet-400/70 text-xs mt-0.5">
                  Período: {preview.mesesDetectados.map(m => {
                    const [y, mo] = m.split("-");
                    return new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
                  }).join(", ")}
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Summary ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex flex-wrap items-center gap-2"
        >
          <button
            onClick={() => setStatusFilter(statusFilter === "Normal" ? "all" : "Normal")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
              statusFilter === "Normal"
                ? "border-emerald-300 bg-emerald-50 shadow-sm dark:border-emerald-700 dark:bg-emerald-950/30"
                : "border-border/50 bg-card hover:bg-muted/60"
            )}
          >
            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{totalNormais}</span>
            <span className="text-muted-foreground font-normal">para importar</span>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === "Duplicata" ? "all" : "Duplicata")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
              statusFilter === "Duplicata"
                ? "border-orange-300 bg-orange-50 shadow-sm dark:border-orange-700 dark:bg-orange-950/30"
                : "border-border/50 bg-card hover:bg-muted/60"
            )}
          >
            <Copy className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
            <span className={cn("font-bold tabular-nums", totalDuplicatas > 0 ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground")}>{totalDuplicatas}</span>
            <span className="text-muted-foreground font-normal">duplicatas</span>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === "Ignorada" ? "all" : "Ignorada")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
              statusFilter === "Ignorada"
                ? "border-neutral-300 bg-neutral-100 shadow-sm dark:border-neutral-600 dark:bg-neutral-800/40"
                : "border-border/50 bg-card hover:bg-muted/60"
            )}
          >
            <Ban className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400" />
            <span className={cn("font-bold tabular-nums", totalIgnoradas > 0 ? "text-neutral-500" : "text-muted-foreground")}>{totalIgnoradas}</span>
            <span className="text-muted-foreground font-normal">ignoradas</span>
          </button>

          <div className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs",
            semCategoria > 0
              ? "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
              : "border-border/50 bg-card"
          )}>
            <Tag className={cn("h-3.5 w-3.5", semCategoria > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
            <span className={cn("font-bold tabular-nums", semCategoria > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{semCategoria}</span>
            <span className="text-muted-foreground font-normal">sem categoria</span>
          </div>

          {statusFilter !== "all" && (
            <>
              <div className="h-4 w-px bg-border" />
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setStatusFilter("all")}>
                <X className="h-3 w-3" />
                Limpar filtro
              </Button>
            </>
          )}
        </motion.div>

        {/* ── Consolidated notification ── */}
        <AnimatePresence>
          {(allDuplicatas || preview.arquivoJaImportado || filteredAvisos.length > 0) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-xl border border-orange-200 bg-linear-to-r from-orange-50 to-orange-50/40 dark:border-orange-800/60 dark:from-orange-950/20 dark:to-orange-950/10 p-4"
            >
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/40">
                  <ShieldAlert className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                    {preview.arquivoJaImportado
                      ? "Arquivo já importado anteriormente"
                      : allDuplicatas
                        ? `Todas as ${totalDuplicatas} transações já existem no sistema`
                        : "Atenção"}
                    {preview.arquivoJaImportado && preview.dataImportacaoAnterior && (
                      <span className="font-normal text-orange-600/70 dark:text-orange-400/50 ml-1.5">
                        · {formatShortDate(preview.dataImportacaoAnterior)}
                      </span>
                    )}
                  </p>
                  {preview.arquivoJaImportado && allDuplicatas && (
                    <p className="text-xs text-orange-600/80 dark:text-orange-400/60">
                      Todas as {totalDuplicatas} transações já existem no sistema. Duplicatas detectadas por valor, data e descrição.
                    </p>
                  )}
                  {!preview.arquivoJaImportado && allDuplicatas && (
                    <p className="text-xs text-orange-600/80 dark:text-orange-400/60">
                      Nenhuma transação nova encontrada. Duplicatas detectadas por valor, data e descrição.
                    </p>
                  )}
                  {filteredAvisos.map((aviso, i) => (
                    <p key={i} className="flex items-center gap-1.5 text-xs text-orange-600/80 dark:text-orange-400/60">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {aviso}
                    </p>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Sem categoria ── */}
        <AnimatePresence>
          {semCategoria > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="flex items-center gap-2 rounded-lg border border-amber-200/60 bg-amber-50/40 dark:border-amber-800/40 dark:bg-amber-950/15 px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-400">
                <Tag className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {semCategoria === 1
                    ? "1 transação sem categoria — será importada como "
                    : `${semCategoria} transações sem categoria — serão importadas como `}
                  <strong>Outras</strong>. Edite clicando em <Pencil className="inline h-3 w-3 mx-0.5 -mt-0.5" />.
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Table ── */}
        <div className="rounded-xl border overflow-hidden shadow-sm">
          {/* Inline toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/20 px-3 py-2 border-b border-border/50">
            <span className="text-xs text-muted-foreground">
              {selected.size} de {selectableCount} selecionadas
              {selected.size > 0 && (
                <Badge variant="outline" className="ml-2 text-xs font-normal">
                  {formatCurrency(valorTotalSelecionado)}
                </Badge>
              )}
            </span>
            <div className="flex items-center gap-1.5">
              {totalDuplicatas > 0 && statusFilter === "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-7 text-xs gap-1.5 px-2.5", !showDuplicatas && "text-orange-600")}
                  onClick={() => setShowDuplicatas(!showDuplicatas)}
                >
                  {showDuplicatas ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {showDuplicatas ? "Ocultar" : "Mostrar"} duplicatas
                </Button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="p-3 w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todas"
                    />
                  </th>
                  <th className="p-3 text-left">
                    <SortHeader field="status">Status</SortHeader>
                  </th>
                  <th className="p-3 text-left">
                    <SortHeader field="data">Data</SortHeader>
                  </th>
                  <th className="p-3 text-left min-w-50">
                    <SortHeader field="descricao">Descrição</SortHeader>
                  </th>
                  <th className="p-3 text-right">
                    <SortHeader field="valor">Valor</SortHeader>
                  </th>
                  <th className="p-3 text-left">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</span>
                  </th>
                  <th className="p-3 text-left">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categoria</span>
                  </th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {Array.from(groupedByMonth.entries()).map(([month, transactions]) => {
                  const monthDuplicatas = transactions.filter((t) => t.status === "Duplicata").length;
                  const monthTotal = transactions.reduce((s, t) => s + Math.abs(t.valor), 0);
                  const collapsed = collapsedMonths.has(month);

                  return (
                    <MonthGroupFragment
                      key={month}
                      monthLabel={formatMonthLabel(month)}
                      count={transactions.length}
                      monthDuplicatas={monthDuplicatas}
                      monthTotal={monthTotal}
                      collapsed={collapsed}
                      onToggle={() => toggleMonth(month)}
                    >
                      {!collapsed &&
                        transactions.map((t) => (
                          <TransactionRow
                            key={t.indiceOriginal}
                            t={t}
                            isSelected={selected.has(t.indiceOriginal)}
                            isEditing={editingRow === t.indiceOriginal}
                            editForm={editForm}
                            setEditForm={setEditForm}
                            onToggleSelect={() => toggleSelect(t.indiceOriginal)}
                            onStartEdit={() => startEdit(t)}
                            onSaveEdit={saveEdit}
                            onCancelEdit={cancelEdit}
                            categoriasLista={categoriasLista}
                            hasOverride={overrides.has(t.indiceOriginal)}
                          />
                        ))}
                    </MonthGroupFragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {sortedTransactions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Filter className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Nenhuma transação com o filtro atual</p>
              <Button variant="link" size="sm" onClick={() => setStatusFilter("all")} className="mt-1 text-xs">
                Limpar filtro
              </Button>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border bg-card p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{selected.size}</span> de {selectableCount} selecionadas
              {selected.size > 0 && (
                <Badge variant="outline" className="text-xs font-normal">
                  {formatCurrency(valorTotalSelecionado)}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onCancel} disabled={isConfirming}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={selected.size === 0 || isConfirming}
                size="default"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Confirmar ({selected.size})
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </TooltipProvider>
  );
}

/* ── Month Group Fragment ── */
function MonthGroupFragment({
  monthLabel,
  count,
  monthDuplicatas,
  monthTotal,
  collapsed,
  onToggle,
  children,
}: {
  monthLabel: string;
  count: number;
  monthDuplicatas: number;
  monthTotal: number;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr
        className="bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <td colSpan={8} className="p-0">
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-2">
              {collapsed ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                {monthLabel}
              </span>
              <span className="text-xs text-muted-foreground font-normal">
                ({count} transações)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {monthDuplicatas > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-400">
                  <Copy className="h-2.5 w-2.5" />
                  {monthDuplicatas} dup.
                </span>
              )}
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatCurrency(monthTotal)}
              </span>
            </div>
          </div>
        </td>
      </tr>
      {children}
    </>
  );
}

/* ── Transaction Row ── */
function TransactionRow({
  t,
  isSelected,
  isEditing,
  editForm,
  setEditForm,
  onToggleSelect,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  categoriasLista,
  hasOverride,
}: {
  t: TransacaoImportada;
  isSelected: boolean;
  isEditing: boolean;
  editForm: Partial<TransacaoOverride>;
  setEditForm: React.Dispatch<React.SetStateAction<Partial<TransacaoOverride>>>;
  onToggleSelect: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  categoriasLista: { id: number; nome: string }[];
  hasOverride: boolean;
}) {
  const statusCfg = STATUS_CONFIG[t.status];
  const StatusIcon = statusCfg.icon;
  const tipoCfg = TIPO_LABEL[t.tipoTransacao];
  const isIgnored = t.status === "Ignorada";
  const isDuplicate = t.status === "Duplicata";
  const isDisabled = isIgnored || isDuplicate;
  const hasNoCategory = !t.categoriaId && !t.categoriaSugerida;

  return (
    <tr
      className={cn(
        "transition-colors group",
        isIgnored && "opacity-40",
        isDuplicate && !isSelected && "opacity-60",
        statusCfg.bgRow,
        isSelected
          ? "bg-emerald-50/50 dark:bg-emerald-950/15 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/20"
          : !isDisabled && "hover:bg-muted/30"
      )}
    >
      {/* Checkbox */}
      <td className="p-3">
        <Checkbox
          checked={isSelected}
          disabled={isDisabled}
          onCheckedChange={onToggleSelect}
        />
      </td>

      {/* Status */}
      <td className="p-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium cursor-default",
                statusCfg.color
              )}
            >
              <StatusIcon className="h-3 w-3" />
              {statusCfg.label}
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="max-w-[220px] bg-background text-foreground border shadow-md [&>svg]:hidden"
          >
            <p className="font-medium text-xs">{statusCfg.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {t.motivoStatus || statusCfg.description}
            </p>
          </TooltipContent>
        </Tooltip>
      </td>

      {/* Data */}
      <td className="p-3 whitespace-nowrap">
        {isEditing ? (
          <Input
            type="date"
            value={editForm.data?.split("T")[0] ?? ""}
            onChange={(e) => setEditForm((f) => ({ ...f, data: e.target.value }))}
            className="h-8 w-36 text-xs"
          />
        ) : (
          <span className="text-xs tabular-nums">{formatShortDate(t.data)}</span>
        )}
      </td>

      {/* Descrição */}
      <td className="p-3">
        {isEditing ? (
          <Input
            value={editForm.descricao ?? ""}
            onChange={(e) => setEditForm((f) => ({ ...f, descricao: e.target.value }))}
            className="h-8 text-xs"
          />
        ) : (
          <div className="flex items-center gap-1.5">
            <span className={cn("text-xs line-clamp-1", isDuplicate && "line-through decoration-orange-400/50")} title={t.descricao}>
              {t.descricao}
            </span>
            {t.totalParcelas && t.totalParcelas > 1 && (
              <span className="shrink-0 inline-flex items-center rounded-md bg-violet-100 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400 tabular-nums">
                {t.numeroParcela}/{t.totalParcelas}
              </span>
            )}
            {hasOverride && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                    <Pencil className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Editado pelo usuário</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </td>

      {/* Valor */}
      <td className="p-3 text-right whitespace-nowrap">
        {isEditing ? (
          <Input
            type="number"
            step="0.01"
            value={editForm.valor ?? 0}
            onChange={(e) => setEditForm((f) => ({ ...f, valor: parseFloat(e.target.value) || 0 }))}
            className="h-8 w-28 text-xs text-right"
          />
        ) : (
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              t.tipoTransacao === "Credito"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            )}
          >
            {t.tipoTransacao === "Credito" ? "+" : "-"}
            {formatCurrency(Math.abs(t.valor))}
          </span>
        )}
      </td>

      {/* Tipo */}
      <td className="p-3">
        <span className={cn("text-xs", tipoCfg.color)}>{tipoCfg.label}</span>
      </td>

      {/* Categoria */}
      <td className="p-3">
        {isEditing ? (
          <Select
            value={String(editForm.categoriaId ?? "")}
            onValueChange={(v) => setEditForm((f) => ({ ...f, categoriaId: parseInt(v) }))}
          >
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              {categoriasLista.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className={cn(
            "text-xs",
            hasNoCategory && isSelected
              ? "text-amber-600 dark:text-amber-400 italic"
              : hasNoCategory
                ? "text-muted-foreground/50"
                : "text-muted-foreground"
          )}>
            {t.categoriaSugerida || (hasNoCategory && isSelected ? "Sem categoria" : "—")}
          </span>
        )}
      </td>

      {/* Actions */}
      <td className="p-3">
        {isEditing ? (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSaveEdit}>
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancelEdit}>
              <X className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity", isDisabled && "hidden")}
            onClick={onStartEdit}
            disabled={isDisabled}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </td>
    </tr>
  );
}
