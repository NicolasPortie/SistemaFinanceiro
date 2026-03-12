"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileText, FileSpreadsheet, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useCartoes, useContasBancarias } from "@/hooks/use-queries";
import type { TipoImportacao } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

const ACCEPTED_EXTENSIONS = [".csv", ".ofx", ".xlsx", ".xls", ".pdf"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const FORMAT_LABELS: Record<string, { label: string; icon: string }> = {
  ".csv": { label: "CSV", icon: "📄" },
  ".ofx": { label: "OFX", icon: "🏦" },
  ".xlsx": { label: "Excel", icon: "📊" },
  ".xls": { label: "Excel", icon: "📊" },
  ".pdf": { label: "PDF", icon: "📕" },
};

interface UploadAreaProps {
  onUpload: (params: {
    arquivo: File;
    tipoImportacao: TipoImportacao;
    contaBancariaId?: number;
    cartaoCreditoId?: number;
    banco?: string;
    forcarReimportacao?: boolean;
  }) => void;
  isLoading: boolean;
}

export function UploadArea({ onUpload, isLoading }: UploadAreaProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [tipoImportacao, setTipoImportacao] = useState<TipoImportacao | "">("");
  const [contaBancariaId, setContaBancariaId] = useState<string>("");
  const [cartaoCreditoId, setCartaoCreditoId] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [forcarReimportacao, setForcarReimportacao] = useState(false);

  const { data: cartoes } = useCartoes();
  const { data: contas } = useContasBancarias();

  const cartoesAtivos = cartoes?.filter((c) => c.ativo) ?? [];
  const contasAtivas = contas?.filter((c) => c.ativo) ?? [];
  const selectedCartao = cartoesAtivos.find((c) => String(c.id) === cartaoCreditoId);

  const validateFile = useCallback((f: File): string | null => {
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return `Formato não suportado. Use: ${ACCEPTED_EXTENSIONS.join(", ")}`;
    }
    if (f.size > MAX_FILE_SIZE) {
      return `Arquivo muito grande (${(f.size / 1024 / 1024).toFixed(1)}MB). Máximo: 5MB.`;
    }
    return null;
  }, []);

  const handleFile = useCallback(
    (f: File) => {
      const error = validateFile(f);
      if (error) {
        setFileError(error);
        setFile(null);
        return;
      }
      setFileError(null);
      setSubmitError(null);
      setFile(f);
    },
    [validateFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleOpenFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSubmit = () => {
    if (!file) return;

    if (!tipoImportacao) {
      setSubmitError(
        "Selecione primeiro se o arquivo é um extrato bancário ou uma fatura de cartão."
      );
      return;
    }

    const isFatura = tipoImportacao === "Fatura";

    // Fatura requer cartão
    if (isFatura && !cartaoCreditoId) {
      setSubmitError(
        "Selecione o cartão para aplicar corretamente o dia de fechamento desta fatura."
      );
      return;
    }

    setSubmitError(null);

    onUpload({
      arquivo: file,
      tipoImportacao,
      contaBancariaId:
        contaBancariaId && contaBancariaId !== "0" ? parseInt(contaBancariaId) : undefined,
      cartaoCreditoId: cartaoCreditoId ? parseInt(cartaoCreditoId) : undefined,
      forcarReimportacao,
    });
  };

  const fileExt = file ? "." + file.name.split(".").pop()?.toLowerCase() : null;
  const formatInfo = fileExt ? FORMAT_LABELS[fileExt] : null;
  const canSubmit =
    !!file && !!tipoImportacao && (tipoImportacao !== "Fatura" || !!cartaoCreditoId);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 sm:p-8 transition-all duration-200 cursor-pointer",
          dragOver
            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
            : file
              ? "border-emerald-300 bg-emerald-50/30 dark:border-emerald-700 dark:bg-emerald-950/10"
              : "border-muted-foreground/25 hover:border-muted-foreground/40 bg-muted/30"
        )}
        role="button"
        tabIndex={0}
        aria-label={
          file
            ? `Arquivo selecionado ${file.name}. Clique para substituir o arquivo.`
            : "Selecionar arquivo para importação"
        }
        aria-describedby="importacao-upload-hint importacao-upload-formats"
        onClick={handleOpenFilePicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpenFilePicker();
          }
        }}
      >
        <input
          id="file-input"
          ref={fileInputRef}
          name="arquivo_importacao"
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={handleFileInput}
          className="hidden"
          aria-label="Selecionar arquivo para importação"
        />

        <AnimatePresence mode="wait">
          {file ? (
            <motion.div
              key="file-selected"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-3 w-full"
            >
              <div className="flex max-w-full items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <FileText className="h-8 w-8 shrink-0" />
                <span className="max-w-full break-all text-sm sm:text-lg font-medium text-center sm:text-left">
                  {file.name}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
                <span>
                  {formatInfo?.icon} {formatInfo?.label}
                </span>
                <span>•</span>
                <span>{(file.size / 1024).toFixed(0)} KB</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setFileError(null);
                }}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remover arquivo selecionado"
              >
                <X className="h-4 w-4 mr-1" />
                Remover
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="drop-hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <Upload className="h-10 w-10 text-muted-foreground/50" />
              <div className="text-center">
                <p id="importacao-upload-hint" className="text-sm font-medium leading-snug">
                  Arraste o arquivo aqui ou clique para selecionar
                </p>
                <p id="importacao-upload-formats" className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  CSV, OFX, XLSX ou PDF • Máximo 5MB
                </p>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {Object.entries(FORMAT_LABELS)
                  .filter(([ext]) => ext !== ".xls")
                  .map(([ext, info]) => (
                    <span
                      key={ext}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs"
                    >
                      {info.icon} {info.label}
                    </span>
                  ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* File Error */}
      <AnimatePresence>
        {fileError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {fileError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Options */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Tipo */}
        <div className="space-y-2">
          <Label htmlFor="importacao-tipo">Tipo de importação</Label>
          <Select
            value={tipoImportacao}
            onValueChange={(value) => {
              setTipoImportacao(value as TipoImportacao);
              setSubmitError(null);
              if (value !== "Fatura") {
                setCartaoCreditoId("");
              }
            }}
          >
            <SelectTrigger id="importacao-tipo">
              <SelectValue placeholder="Selecione se é extrato ou fatura" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Extrato">Extrato bancário</SelectItem>
              <SelectItem value="Fatura">Fatura de Cartão</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Conta bancária (for extrato) */}
        {tipoImportacao === "Extrato" && contasAtivas.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="importacao-conta-bancaria">Conta bancária (opcional)</Label>
            <Select value={contaBancariaId} onValueChange={setContaBancariaId}>
              <SelectTrigger id="importacao-conta-bancaria">
                <SelectValue placeholder="Auto-detectar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Auto-detectar</SelectItem>
                {contasAtivas.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Cartão (for fatura) */}
        {tipoImportacao === "Fatura" && (
          <div className="space-y-2">
            <Label htmlFor="importacao-cartao">Cartão de crédito</Label>
            <Select value={cartaoCreditoId} onValueChange={setCartaoCreditoId}>
              <SelectTrigger id="importacao-cartao">
                <SelectValue placeholder="Selecione o cartão" />
              </SelectTrigger>
              <SelectContent>
                {cartoesAtivos.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

      </div>

      <AnimatePresence>
        {tipoImportacao === "Fatura" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-violet-200 bg-violet-50/70 dark:border-violet-800 dark:bg-violet-950/20 p-4"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-700 dark:text-violet-300">
              Regra da fatura
            </p>
            <p className="mt-2 text-sm text-violet-900/90 dark:text-violet-100/85 leading-relaxed">
              {selectedCartao
                ? `Para ${selectedCartao.nome}, compras feitas até o dia ${selectedCartao.diaFechamento} entram na fatura do mês corrente. Após esse dia, elas entram na próxima fatura.`
                : "Selecione o cartão para aplicar o dia de fechamento correto. O sistema usa esse dia para decidir se cada compra entra na fatura atual ou na próxima."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {submitError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-300"
            role="alert"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {submitError}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-200/70 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0 dark:border-slate-800/70 dark:bg-[#161B22]/95 sm:dark:bg-transparent">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {file ? (
            <label
              htmlFor="importacao-forcar-reimportacao"
              className="flex items-start gap-2 text-xs sm:text-sm cursor-pointer text-muted-foreground sm:max-w-md"
            >
              <input
                id="importacao-forcar-reimportacao"
                type="checkbox"
                checked={forcarReimportacao}
                onChange={(e) => setForcarReimportacao(e.target.checked)}
                className="mt-0.5 rounded border-muted-foreground"
              />
              <span>Forçar reimportação (ignorar arquivo já importado)</span>
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">
              Selecione um arquivo e o tipo de importação para liberar o processamento.
            </p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isLoading}
            className="w-full sm:w-auto sm:min-w-45 h-11 rounded-xl sm:rounded-md"
          >
          {isLoading ? (
            <>
              <FileSpreadsheet className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Processar Arquivo
            </>
          )}
          </Button>
        </div>
      </div>
    </div>
  );
}
