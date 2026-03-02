"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, History, CheckCircle2, Eye, Upload } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageShell, PageHeader } from "@/components/shared/page-components";
import { UploadArea } from "@/components/importacao/upload-area";
import { PreviewTable } from "@/components/importacao/preview-table";
import { Resultado } from "@/components/importacao/resultado";
import { HistoricoImportacao } from "@/components/importacao/historico";
import { useUploadImportacao, useConfirmarImportacao } from "@/hooks/use-queries";
import type { ImportacaoPreview, ImportacaoResultado, TransacaoOverride } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type Step = "upload" | "preview" | "resultado";

const STEPS: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: "upload", label: "Upload", icon: Upload },
  { key: "preview", label: "Revisar", icon: Eye },
  { key: "resultado", label: "Resultado", icon: CheckCircle2 },
];

export default function ImportacaoPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<ImportacaoPreview | null>(null);
  const [resultado, setResultado] = useState<ImportacaoResultado | null>(null);
  const [activeTab, setActiveTab] = useState("importar");

  const uploadMutation = useUploadImportacao();
  const confirmarMutation = useConfirmarImportacao();

  const handleUpload = (params: {
    arquivo: File;
    tipoImportacao: string;
    contaBancariaId?: number;
    cartaoCreditoId?: number;
    banco?: string;
    forcarReimportacao?: boolean;
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
          setResultado(data);
          setStep("resultado");
        },
      }
    );
  };

  const handleCancel = () => {
    setStep("upload");
    setPreview(null);
    setResultado(null);
  };

  const handleNovaImportacao = () => {
    setStep("upload");
    setPreview(null);
    setResultado(null);
  };

  const handleVerLancamentos = () => {
    router.push("/lancamentos");
  };

  const currentStepIdx = STEPS.findIndex((s) => s.key === step);

  const stepDescriptions: Record<Step, string> = {
    upload: "Selecione o arquivo do extrato ou fatura para importar",
    preview: `${preview?.totalTransacoes ?? 0} transações encontradas — ${preview?.bancoDetectado ?? ""}`,
    resultado: resultado
      ? `${resultado.totalImportadas} lançamentos importados`
      : "",
  };

  return (
    <PageShell>
      <PageHeader
        title="Importar Extratos"
        description="Importe extratos bancários e faturas de cartão automaticamente"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="importar" className="gap-2">
            <FileUp className="h-4 w-4" />
            Importar
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="importar">
          {/* Step indicator */}
          <div className="flex items-center gap-0 mb-6">
            {STEPS.map((s, i) => {
              const isActive = s.key === step;
              const isCompleted = i < currentStepIdx;
              const Icon = s.icon;

              return (
                <div key={s.key} className="flex items-center">
                  {i > 0 && (
                    <div
                      className={cn(
                        "h-px w-8 sm:w-12 transition-colors",
                        isCompleted || isActive ? "bg-emerald-500" : "bg-border"
                      )}
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all",
                        isActive
                          ? "bg-emerald-600 text-white shadow-sm shadow-emerald-200 dark:shadow-emerald-900"
                          : isCompleted
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-xs hidden sm:inline transition-colors",
                        isActive ? "font-semibold text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Step description */}
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">
              {stepDescriptions[step]}
            </p>
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            {step === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <UploadArea onUpload={handleUpload} isLoading={uploadMutation.isPending} />
              </motion.div>
            )}

            {step === "preview" && preview && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <PreviewTable
                  preview={preview}
                  onConfirm={handleConfirm}
                  onCancel={handleCancel}
                  isConfirming={confirmarMutation.isPending}
                />
              </motion.div>
            )}

            {step === "resultado" && resultado && (
              <motion.div
                key="resultado"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <Resultado
                  resultado={resultado}
                  onNovaImportacao={handleNovaImportacao}
                  onVerLancamentos={handleVerLancamentos}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>

        <TabsContent value="historico">
          <HistoricoImportacao />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
