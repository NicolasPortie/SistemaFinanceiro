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
  Eye,
  EyeOff,
  Filter,
  Tag,
  CalendarRange,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatCurrency, formatMonth, formatShortDate } from "@/lib/format";
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
    color:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
    bgRow: "",
    icon: Check,
    description: "Transação válida e pronta para importar",
  },
  Suspeita: {
    label: "Suspeita",
    color:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
    bgRow: "bg-amber-50/40 dark:bg-amber-950/10",
    icon: AlertTriangle,
    description: "Transação com dados que podem precisar de revisão",
  },
  Duplicata: {
    label: "Duplicata",
    color:
      "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
    bgRow: "bg-orange-50/40 dark:bg-orange-950/10",
    icon: Copy,
    description: "Já existe um lançamento igual ou muito similar",
  },
  Ignorada: {
    label: "Ignorada",
    color:
      "bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-neutral-800/30 dark:text-neutral-400 dark:border-neutral-700",
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

type SortField = "data" | "valor" | "descricao";
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
  const isFaturaImport = preview.tipoImportacao === "Fatura";

  // Selection state
  const [selected, setSelected] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    preview.transacoes.forEach((t) => {
      if (t.selecionada && t.status !== "Ignorada" && t.status !== "Duplicata")
        initial.add(t.indiceOriginal);
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
  const [showOnlyForaDaFaturaPadrao, setShowOnlyForaDaFaturaPadrao] = useState(false);

  const addMonthsToKey = (key: string, delta: number) => {
    const [year, month] = key.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  const formatInvoiceMonthKey = (key?: string | null) => {
    if (!key) return "—";
    const [year, month] = key.split("-");
    return formatMonth(`${month}/${year}`);
  };

  const mesFaturaOptions = useMemo(() => {
    if (!isFaturaImport) return [] as string[];

    const base =
      preview.mesFaturaPadrao ?? preview.mesesDetectados[0] ?? new Date().toISOString().slice(0, 7);
    const values = new Set<string>([
      addMonthsToKey(base, -2),
      addMonthsToKey(base, -1),
      base,
      addMonthsToKey(base, 1),
      addMonthsToKey(base, 2),
      ...preview.mesesDetectados,
    ]);

    return Array.from(values).sort();
  }, [isFaturaImport, preview.mesFaturaPadrao, preview.mesesDetectados]);

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
          (override?.categoria ?? override?.categoriaId)
            ? (categoriasLista.find((c) => c.id === (override?.categoriaId ?? t.categoriaId))
                ?.nome ?? t.categoriaSugerida)
            : t.categoriaSugerida,
        mesFaturaReferencia: override?.mesFaturaReferencia ?? preview.mesFaturaPadrao ?? null,
      };
    },
    [overrides, categoriasLista, preview.mesFaturaPadrao]
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

    if (isFaturaImport && showOnlyForaDaFaturaPadrao && preview.mesFaturaPadrao) {
      items = items.filter(
        (t) => t.mesFaturaReferencia && t.mesFaturaReferencia !== preview.mesFaturaPadrao
      );
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
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return items;
  }, [
    preview.transacoes,
    sortField,
    sortDir,
    getDisplayTransaction,
    statusFilter,
    showDuplicatas,
    isFaturaImport,
    showOnlyForaDaFaturaPadrao,
    preview.mesFaturaPadrao,
  ]);

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
    (t) =>
      selected.has(t.indiceOriginal) &&
      !overrides.get(t.indiceOriginal)?.categoriaId &&
      !t.categoriaId
  ).length;
  const valorTotalGeral = preview.transacoes
    .filter((t) => t.status !== "Ignorada" && t.status !== "Duplicata")
    .reduce((sum, t) => sum + Math.abs(overrides.get(t.indiceOriginal)?.valor ?? t.valor), 0);
  const valorTotalSelecionado = preview.transacoes
    .filter((t) => selected.has(t.indiceOriginal))
    .reduce((sum, t) => sum + Math.abs(overrides.get(t.indiceOriginal)?.valor ?? t.valor), 0);

  const toggleSelectAll = () => {
    const selectable = preview.transacoes.filter(
      (t) => t.status !== "Ignorada" && t.status !== "Duplicata"
    );
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
      mesFaturaReferencia: override?.mesFaturaReferencia ?? preview.mesFaturaPadrao ?? undefined,
    });
  };

  const saveEdit = () => {
    if (editingRow === null) return;
    const original = preview.transacoes.find((t) => t.indiceOriginal === editingRow);
    if (!original) return;

    const ov: TransacaoOverride = { indiceOriginal: editingRow };
    if (editForm.data && editForm.data !== original.data) ov.data = editForm.data;
    if (editForm.descricao && editForm.descricao !== original.descricao)
      ov.descricao = editForm.descricao;
    if (editForm.valor !== undefined && editForm.valor !== original.valor)
      ov.valor = editForm.valor;
    if (editForm.categoriaId && editForm.categoriaId !== original.categoriaId) {
      ov.categoriaId = editForm.categoriaId;
      ov.categoria = categoriasLista.find((c) => c.id === editForm.categoriaId)?.nome;
    }
    if (
      isFaturaImport &&
      editForm.mesFaturaReferencia &&
      editForm.mesFaturaReferencia !== preview.mesFaturaPadrao
    ) {
      ov.mesFaturaReferencia = editForm.mesFaturaReferencia;
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

  const selectableCount = preview.transacoes.filter(
    (t) => t.status !== "Ignorada" && t.status !== "Duplicata"
  ).length;
  const allSelected = selected.size === selectableCount && selectableCount > 0;
  const allDuplicatas = totalDuplicatas === preview.totalTransacoes && totalDuplicatas > 0;
  const totalForaDaFaturaPadrao = useMemo(() => {
    if (!isFaturaImport || !preview.mesFaturaPadrao) return 0;
    return preview.transacoes
      .map(getDisplayTransaction)
      .filter((t) => t.mesFaturaReferencia && t.mesFaturaReferencia !== preview.mesFaturaPadrao)
      .length;
  }, [isFaturaImport, preview.mesFaturaPadrao, preview.transacoes, getDisplayTransaction]);

  // Filter avisos that duplicate the "already imported" info
  const filteredAvisos = useMemo(() => {
    if (!preview.arquivoJaImportado) return preview.avisos;
    return preview.avisos.filter((a) => !a.toLowerCase().includes("já foi importado"));
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
              {preview.mesesDetectados.length > 0 &&
                (() => {
                  // Mostrar apenas o mês predominante (mais transações)
                  const mesPrincipal = preview.mesesDetectados[preview.mesesDetectados.length - 1];
                  const [y, mo] = mesPrincipal.split("-");
                  const mesFormatado = new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString(
                    "pt-BR",
                    { month: "long", year: "numeric" }
                  );
                  return (
                    <p className="text-violet-600/80 dark:text-violet-400/70 text-xs mt-0.5 capitalize">
                      {mesFormatado}
                    </p>
                  );
                })()}
              {preview.cartaoDiaFechamento && (
                <p className="text-[11px] text-violet-700/80 dark:text-violet-300/80 mt-2 leading-relaxed">
                  Fechamento no dia <strong>{preview.cartaoDiaFechamento}</strong>. Se necessário,
                  ajuste a <strong>Fatura destino</strong> no lápis.
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Filter Summary chips ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex flex-wrap items-center gap-2"
        >
          {isFaturaImport && preview.mesFaturaPadrao && totalForaDaFaturaPadrao > 0 && (
            <button
              onClick={() => setShowOnlyForaDaFaturaPadrao((current) => !current)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all opacity-80 hover:opacity-100",
                showOnlyForaDaFaturaPadrao
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <CalendarRange className="h-3 w-3" />
              <span>{totalForaDaFaturaPadrao} fora da fatura</span>
            </button>
          )}

          <button
            onClick={() => setStatusFilter(statusFilter === "Normal" ? "all" : "Normal")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all opacity-80 hover:opacity-100",
              statusFilter === "Normal"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            <Check className="h-3 w-3" />
            <span>{totalNormais} normais</span>
          </button>

          {totalDuplicatas > 0 && (
            <button
              onClick={() => setStatusFilter(statusFilter === "Duplicata" ? "all" : "Duplicata")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all opacity-80 hover:opacity-100",
                statusFilter === "Duplicata"
                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <Copy className="h-3 w-3" />
              <span>{totalDuplicatas} duplicatas</span>
            </button>
          )}

          {totalIgnoradas > 0 && (
            <button
              onClick={() => setStatusFilter(statusFilter === "Ignorada" ? "all" : "Ignorada")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all opacity-80 hover:opacity-100",
                statusFilter === "Ignorada"
                  ? "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <Ban className="h-3 w-3" />
              <span>{totalIgnoradas} ignoradas</span>
            </button>
          )}

          {semCategoria > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 px-3 py-1.5 text-xs font-medium opacity-80">
              <Tag className="h-3 w-3" />
              <span>{semCategoria} sem categoria</span>
            </div>
          )}

          {(statusFilter !== "all" || showOnlyForaDaFaturaPadrao) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 opacity-70 hover:opacity-100 rounded-full"
              onClick={() => {
                setStatusFilter("all");
                setShowOnlyForaDaFaturaPadrao(false);
              }}
            >
              <X className="h-3 w-3" />
              Limpar filtros
            </Button>
          )}
        </motion.div>

        {/* ── Consolidated notification ── */}
        <AnimatePresence>
          {(allDuplicatas || preview.arquivoJaImportado || filteredAvisos.length > 0) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-xl border border-orange-200/50 bg-orange-50/30 dark:border-orange-900/30 dark:bg-orange-950/20 p-3"
            >
              <div className="flex gap-2.5 items-start">
                <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs font-medium text-orange-800 dark:text-orange-300">
                    {preview.arquivoJaImportado
                      ? "Arquivo já importado anteriormente"
                      : allDuplicatas
                        ? `Todas as ${totalDuplicatas} transações já existem no sistema`
                        : "Atenção"}
                    {preview.arquivoJaImportado && preview.dataImportacaoAnterior && (
                      <span className="font-normal text-orange-600/70 ml-1.5">
                        · {formatShortDate(preview.dataImportacaoAnterior)}
                      </span>
                    )}
                  </p>
                  {filteredAvisos.map((aviso, i) => (
                    <p key={i} className="text-[11px] text-orange-700/80 dark:text-orange-400/80">
                      {aviso}
                    </p>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Table ── */}
        <div className="rounded-xl border overflow-hidden shadow-sm">
          {/* Inline toolbar */}
          <div className="flex flex-wrap items-center justify-end gap-2 bg-muted/20 px-3 py-2 border-b border-border/50">
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
            <table className="min-w-max w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="w-12 px-4 py-3.5">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todas"
                    />
                  </th>
                  <th className="min-w-28 px-4 py-3.5 text-left">
                    <SortHeader field="data">Data</SortHeader>
                  </th>
                  <th className="min-w-80 px-4 py-3.5 text-left">
                    <SortHeader field="descricao">Descrição</SortHeader>
                  </th>
                  <th className="min-w-32 px-4 py-3.5 text-right">
                    <SortHeader field="valor">Valor</SortHeader>
                  </th>
                  <th className="min-w-24 px-4 py-3.5 text-left">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Tipo
                    </span>
                  </th>
                  <th className="min-w-32 px-4 py-3.5 text-left">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Categoria
                    </span>
                  </th>
                  {isFaturaImport && (
                    <th className="min-w-28 px-4 py-3.5 text-left">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Fatura destino
                      </span>
                    </th>
                  )}
                  <th className="w-12 px-4 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {Array.from(groupedByMonth.entries()).map(([month, transactions]) => {
                  const monthDuplicatas = transactions.filter(
                    (t) => t.status === "Duplicata"
                  ).length;
                  const monthTotal = transactions.reduce((s, t) => s + Math.abs(t.valor), 0);
                  const collapsed = collapsedMonths.has(month);

                  return (
                    <MonthGroupFragment
                      key={month}
                      monthLabel={formatMonthLabel(month)}
                      count={transactions.length}
                      monthDuplicatas={monthDuplicatas}
                      monthTotal={monthTotal}
                      colSpan={isFaturaImport ? 8 : 7}
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
                            isFaturaImport={isFaturaImport}
                            mesFaturaPadrao={preview.mesFaturaPadrao}
                            mesFaturaOptions={mesFaturaOptions}
                            mesFaturaAtual={
                              (t as TransacaoImportada & { mesFaturaReferencia?: string | null })
                                .mesFaturaReferencia ??
                              preview.mesFaturaPadrao ??
                              null
                            }
                            formatInvoiceMonthKey={formatInvoiceMonthKey}
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
              <Button
                variant="link"
                size="sm"
                onClick={() => setStatusFilter("all")}
                className="mt-1 text-xs"
              >
                Limpar filtro
              </Button>
            </div>
          )}
        </div>

        {/* ── Floating action bar ── */}
        <div className="sticky bottom-0 z-20 -mx-1 px-1 pb-1 pt-3 bg-linear-to-t from-white via-white/95 to-transparent dark:from-[#161B22] dark:via-[#161B22]/95">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-stretch gap-3 rounded-2xl border border-border/60 bg-white/90 dark:bg-[#161B22]/90 backdrop-blur-md shadow-lg shadow-black/5 dark:shadow-black/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5"
          >
            {/* Left: totals */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full transition-colors",
                    selected.size > 0 ? "bg-emerald-500" : "bg-muted-foreground/30"
                  )}
                />
                <span className="text-[11px] font-bold text-foreground tabular-nums">
                  {selected.size}
                </span>
                <span className="text-[10px] text-muted-foreground">de {selectableCount}</span>
              </div>
              <div className="hidden h-4 w-px bg-border/50 sm:block" />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground font-medium">Total:</span>
                <span className="text-[11px] font-bold text-foreground tabular-nums">
                  {formatCurrency(valorTotalGeral)}
                </span>
              </div>
              <div className="hidden h-4 w-px bg-border/50 sm:block" />
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    selected.size > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  )}
                >
                  Selecionado:
                </span>
                <span
                  className={cn(
                    "text-[11px] font-bold tabular-nums",
                    selected.size > 0
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-muted-foreground"
                  )}
                >
                  {formatCurrency(valorTotalSelecionado)}
                </span>
              </div>
            </div>

            {/* Right: actions */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isConfirming}
                className="rounded-full text-[10px] uppercase tracking-wider h-9 px-4 w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={selected.size === 0 || isConfirming}
                size="sm"
                className="rounded-full text-[10px] uppercase tracking-wider h-9 px-5 w-full sm:w-auto"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Confirmar ({selected.size})
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
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
  colSpan,
  collapsed,
  onToggle,
  children,
}: {
  monthLabel: string;
  count: number;
  monthDuplicatas: number;
  monthTotal: number;
  colSpan: number;
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
        <td colSpan={colSpan} className="p-0">
          <div className="flex items-center justify-between px-4 py-3">
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
  isFaturaImport,
  mesFaturaPadrao,
  mesFaturaOptions,
  mesFaturaAtual,
  formatInvoiceMonthKey,
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
  isFaturaImport: boolean;
  mesFaturaPadrao: string | null;
  mesFaturaOptions: string[];
  mesFaturaAtual: string | null;
  formatInvoiceMonthKey: (key?: string | null) => string;
}) {
  const statusCfg = STATUS_CONFIG[t.status];
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
          ? "bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/40"
          : !isDisabled && "hover:bg-muted/30"
      )}
    >
      {/* Checkbox */}
      <td
        className={cn(
          "px-4 py-4 transition-colors",
          isSelected && "border-l-[3px] border-l-emerald-500"
        )}
      >
        <Checkbox checked={isSelected} disabled={isDisabled} onCheckedChange={onToggleSelect} />
      </td>

      {/* Data */}
      <td className="px-4 py-4 align-middle whitespace-nowrap">
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
      <td className="min-w-80 px-4 py-4 align-middle">
        {isEditing ? (
          <Input
            value={editForm.descricao ?? ""}
            onChange={(e) => setEditForm((f) => ({ ...f, descricao: e.target.value }))}
            className="h-8 text-xs"
          />
        ) : (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-xs line-clamp-2 leading-relaxed",
                isDuplicate && "line-through decoration-orange-400/50"
              )}
              title={t.descricao}
            >
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
      <td className="px-4 py-4 align-middle text-right whitespace-nowrap">
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
      <td className="px-4 py-4 align-middle">
        <span className={cn("text-xs", tipoCfg.color)}>{tipoCfg.label}</span>
      </td>

      {/* Categoria */}
      <td className="px-4 py-4 align-middle">
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
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span
            className={cn(
              "text-xs",
              hasNoCategory && isSelected
                ? "text-amber-600 dark:text-amber-400 italic"
                : hasNoCategory
                  ? "text-muted-foreground/50"
                  : "text-muted-foreground"
            )}
          >
            {t.categoriaSugerida || (hasNoCategory && isSelected ? "Sem categoria" : "—")}
          </span>
        )}
      </td>

      {isFaturaImport && (
        <td className="px-4 py-4 align-middle">
          {isEditing ? (
            <Select
              value={editForm.mesFaturaReferencia ?? mesFaturaPadrao ?? ""}
              onValueChange={(v) => setEditForm((f) => ({ ...f, mesFaturaReferencia: v }))}
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Fatura" />
              </SelectTrigger>
              <SelectContent>
                {mesFaturaOptions.map((mes) => (
                  <SelectItem key={mes} value={mes}>
                    {formatInvoiceMonthKey(mes)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium",
                mesFaturaAtual !== mesFaturaPadrao
                  ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300"
                  : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
              )}
            >
              {formatInvoiceMonthKey(mesFaturaAtual)}
            </span>
          )}
        </td>
      )}

      {/* Actions */}
      <td className="px-4 py-4 align-middle">
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
            className={cn(
              "h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity",
              isDisabled && "hidden"
            )}
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
