"use client";

import { useState } from "react";
import { FileUp, History, CheckCircle2, Eye, Upload } from "lucide-react";

import { UploadArea } from "@/components/importacao/upload-area";
import { PreviewTable } from "@/components/importacao/preview-table";
import { HistoricoImportacao } from "@/components/importacao/historico";
import { useUploadImportacao, useConfirmarImportacao } from "@/hooks/use-queries";
import type { ImportacaoPreview, TipoImportacao, TransacaoOverride } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Step = "upload" | "preview";

const STEPS: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: "upload", label: "Upload", icon: Upload },
  { key: "preview", label: "Revisar", icon: Eye },
];

export default function ImportacaoPage() {
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<ImportacaoPreview | null>(null);

  const uploadMutation = useUploadImportacao();
  const confirmarMutation = useConfirmarImportacao();

  const handleUpload = (params: {
    arquivo: File;
    tipoImportacao: TipoImportacao;
    contaBancariaId?: number;
    cartaoCreditoId?: number;
    banco?: string;
    forcarReimportacao?: boolean;
    mesFaturaReferencia?: string;
  }) => {
    uploadMutation.mutate(params, {
      onSuccess: (data) => {
        setPreview(data);
        setStep("preview");
      },
    });
  };

  const handleConfirm = (indicesSelecionados: number[], overrides: TransacaoOverride[]) => {
    if (!preview) return;

    confirmarMutation.mutate(
      {
        importacaoHistoricoId: preview.importacaoHistoricoId,
        indicesSelecionados,
        overrides,
      },
      {
        onSuccess: (data) => {
          toast.success(
            `${data.totalImportadas} lançamento${data.totalImportadas !== 1 ? "s" : ""} importado${data.totalImportadas !== 1 ? "s" : ""} com sucesso!`
          );
          setStep("upload");
          setPreview(null);
        },
      }
    );
  };

  const handleCancel = () => {
    setStep("upload");
    setPreview(null);
  };

  const currentStepIdx = STEPS.findIndex((s) => s.key === step);
  const isPreviewExpanded = step === "preview" && preview !== null;

  const formatMes = (mes?: string) => {
    if (!mes) return "—";
    const [ano, mesNumero] = mes.split("-");
    return new Date(parseInt(ano, 10), parseInt(mesNumero, 10) - 1, 1).toLocaleDateString("pt-BR", {
      month: "short",
      year: "numeric",
    });
  };

  const periodoResumo = !preview?.mesesDetectados?.length
    ? "—"
    : preview.mesesDetectados.length === 1
      ? formatMes(preview.mesesDetectados[0])
      : `${formatMes(preview.mesesDetectados[0])} - ${formatMes(preview.mesesDetectados[preview.mesesDetectados.length - 1])}`;

  const stepDescriptions: Record<Step, string> = {
    upload: "Escolha o tipo do arquivo antes de iniciar a leitura da importação",
    preview: `${preview?.totalTransacoes ?? 0} transações encontradas — ${preview?.bancoDetectado ?? ""}`,
  };

  const historyCard = (
    <div className={cn(isPreviewExpanded ? "col-span-1" : "col-span-12 lg:col-span-9")}>
      <div className="glass-card bg-white dark:bg-[#161B22] rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] overflow-hidden">
        <div className="px-5 sm:px-8 py-4 sm:py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h4 className="text-[9px] font-bold text-slate-900 dark:text-white uppercase tracking-[0.3em]">
            Histórico de Importações
          </h4>
          <History className="w-4 h-4 text-slate-300 dark:text-slate-600" />
        </div>
        <div>
          <HistoricoImportacao />
        </div>
      </div>
    </div>
  );

  const summaryCard = (
    <div className={cn(isPreviewExpanded ? "col-span-1" : "col-span-12 lg:col-span-3")}>
      <div
        className={cn(
          "glass-card bg-white dark:bg-[#161B22] rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-5 sm:p-7 lg:p-8 flex flex-col",
          isPreviewExpanded ? "" : "sticky top-32"
        )}
      >
        <div className="flex items-center justify-between mb-8">
          <h4 className="text-[9px] font-bold text-slate-900 dark:text-white uppercase tracking-[0.3em]">
            Resumo da Importação
          </h4>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 text-slate-300 dark:text-slate-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
            />
          </svg>
        </div>

        <div className="space-y-6 flex-1 mb-10">
          <div className="flex gap-2" aria-hidden="true">
            {STEPS.map((s, i) => {
              const isActive = s.key === step;
              const isCompleted = i < currentStepIdx;
              return (
                <div
                  key={s.key}
                  className={cn(
                    "flex-1 h-1.5 rounded-full transition-all",
                    isCompleted
                      ? "bg-emerald-500"
                      : isActive
                        ? "bg-slate-900 dark:bg-white"
                        : "bg-slate-100 dark:bg-slate-700"
                  )}
                />
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
            {stepDescriptions[step]}
          </p>

          <div className="h-px w-full bg-slate-100 dark:bg-slate-700" />

          {preview ? (
            <>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0 mt-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mb-1">
                    Status do Arquivo
                  </p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-40">
                    {preview.bancoDetectado ?? "Arquivo carregado"}
                  </p>
                  <p className="text-[10px] text-emerald-600 font-medium mt-1">
                    Validado com sucesso
                  </p>
                </div>
              </div>

              <div className="h-px w-full bg-slate-100 dark:bg-slate-700" />

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mb-2">
                    Transações
                  </p>
                  <p className="text-xl mono-data font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {preview.totalTransacoes}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mb-2">
                    Período
                  </p>
                  <p className="text-xl mono-data font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {periodoResumo}
                  </p>
                </div>
              </div>

              {preview.tipoImportacao !== "Fatura" && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
                  <div className="mb-3 flex items-center gap-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 text-indigo-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                      />
                    </svg>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-900 dark:text-white">
                      Revisão da importação
                    </p>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {preview.totalTransacoes} lançamentos prontos para revisão antes da confirmação.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800/80 flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-700">
                <FileUp className="w-7 h-7 text-slate-300 dark:text-slate-500" />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                Nenhum arquivo carregado
              </p>
              <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">
                Faça upload para ver o resumo
              </p>
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-slate-100 dark:border-slate-700 space-y-3">
          {step !== "upload" && (
            <button
              onClick={handleCancel}
              className="w-full py-3 rounded-full bg-transparent text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              Cancelar Importação
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5 sm:gap-8">
      {/* Header */}
      <div className="pl-4">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl text-slate-900 dark:text-white serif-italic mb-2">
          Importação
        </h1>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.3em]">
          Upload e Conciliação de Extratos Bancários
        </p>
      </div>

      <div
        className={cn(
          "grid gap-5 sm:gap-8",
          isPreviewExpanded ? "grid-cols-1" : "grid-cols-12 lg:gap-6 xl:gap-8"
        )}
      >
        {/* Left panel — wider main area */}
        <div
          className={cn(
            "flex flex-col gap-5 sm:gap-8",
            isPreviewExpanded ? "col-span-1" : "col-span-12 lg:col-span-9"
          )}
        >
          <AnimatePresence mode="wait">
            {step === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="glass-card bg-white dark:bg-[#161B22] rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-5 sm:p-8 lg:p-10"
              >
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-lg text-slate-900 dark:text-white font-semibold">
                      Importe extratos e faturas com revisão antes de confirmar
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
                      Escolha o tipo do arquivo antes de processar. Em faturas de cartão, a leitura
                      respeita o dia de fechamento configurado para decidir se cada compra entra na
                      fatura atual ou na próxima.
                    </p>
                  </div>
                  <UploadArea onUpload={handleUpload} isLoading={uploadMutation.isPending} />
                </div>
              </motion.div>
            )}

            {step === "preview" && preview && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="glass-card bg-white dark:bg-[#161B22] rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] overflow-hidden flex flex-col min-h-100"
              >
                <div className="px-5 sm:px-8 py-4 sm:py-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h4 className="text-[9px] font-bold text-slate-900 dark:text-white uppercase tracking-[0.3em]">
                    Lançamentos Identificados
                  </h4>
                  <div className="flex items-center gap-3">
                    <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-700">
                      {preview.totalTransacoes} Lançamentos
                    </span>
                    {preview.bancoDetectado && (
                      <span className="text-[8px] text-indigo-500 font-bold uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                        {preview.bancoDetectado}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <PreviewTable
                    preview={preview}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                    isConfirming={confirmarMutation.isPending}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {summaryCard}
        {historyCard}
      </div>
    </div>
  );
}
