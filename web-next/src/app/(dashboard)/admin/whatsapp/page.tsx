"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type WhatsAppStatusResponse,
  type WhatsAppQrResponse,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  MessageCircle,
  Wifi,
  WifiOff,
  QrCode,
  RefreshCw,
  Power,
  Phone,
  Clock,
  Smartphone,
  Activity,
  Copy,
  Check,
} from "lucide-react";

function formatUptime(seconds?: number): string {
  if (!seconds || seconds <= 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d} dia${d > 1 ? "s" : ""}`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}min`);
  return parts.join(", ") || "< 1 min";
}

function formatPhone(phone?: string): string {
  if (!phone) return "—";
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 13) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  if (clean.length === 12) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
  }
  return `+${clean}`;
}

export default function AdminWhatsAppPage() {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const {
    data: status,
    isLoading: loadingStatus,
    error: statusError,
    refetch: refetchStatus,
  } = useQuery<WhatsAppStatusResponse>({
    queryKey: ["admin", "whatsapp", "status"],
    queryFn: () => api.admin.whatsapp.status(),
    refetchInterval: 10_000,
    retry: false,
    gcTime: 0,
  });

  const {
    data: qrData,
    isLoading: loadingQr,
    refetch: refetchQr,
  } = useQuery<WhatsAppQrResponse>({
    queryKey: ["admin", "whatsapp", "qr"],
    queryFn: () => api.admin.whatsapp.qr(),
    enabled: !status?.connected,
    refetchInterval: !status?.connected ? 15_000 : false,
    retry: false,
    gcTime: 0,
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.admin.whatsapp.disconnect(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "whatsapp"] });
    },
  });

  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(t);
    }
  }, [copied]);

  const handleCopyPairingCode = () => {
    if (qrData?.pairingCode) {
      navigator.clipboard.writeText(qrData.pairingCode);
      setCopied(true);
    }
  };

  if (loadingStatus) {
    return (
      <div className="flex flex-col gap-8">
        <div className="pl-4">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 sm:h-48 rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem]" />
          ))}
        </div>
        <Skeleton className="h-64 sm:h-96 rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem]" />
      </div>
    );
  }

  const isConnected = status?.connected === true;
  const bridgeOffline = !!statusError;

  return (
    <div className="flex flex-col gap-6 sm:gap-10">
      {/* Bridge offline warning */}
      {bridgeOffline && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-100 rounded-2xl">
          <WifiOff className="w-4 h-4 text-rose-500 shrink-0" />
          <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">
            Bridge offline — inicie o servidor WhatsApp (localhost:3100) e clique em Atualizar.
          </p>
        </div>
      )}
      {/* Header */}
      <div className="pl-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl text-slate-900 serif-italic mb-2">
            WhatsApp
          </h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">
            Gerenciamento da Conexão Baileys
          </p>
        </div>
        <button
          onClick={() => {
            refetchStatus();
            if (!isConnected) refetchQr();
          }}
          className="bg-white border border-slate-200 text-slate-600 px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* Status Cards */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8"
      >
        {/* Connection Status */}
        <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-5 sm:p-8 lg:p-10 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity text-slate-900">
            {isConnected ? (
              <Wifi className="w-28 h-28" />
            ) : (
              <WifiOff className="w-28 h-28" />
            )}
          </div>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em] mb-6">
            Status da Conexão
          </p>
          <div className="flex items-center gap-3 mb-3">
            <span
              className={cn(
                "w-3 h-3 rounded-full",
                isConnected
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
              )}
            />
            <span className="text-2xl serif-italic text-slate-900">
              {isConnected ? "Conectado" : "Desconectado"}
            </span>
          </div>
          <p className="text-[10px] mono-data text-slate-500 font-bold">
            {isConnected
              ? "Sessão ativa e recebendo mensagens"
              : "Escaneie o QR Code para conectar"}
          </p>
        </div>

        {/* Phone Number */}
        <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-5 sm:p-8 lg:p-10 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity text-slate-900">
            <Phone className="w-28 h-28" />
          </div>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em] mb-6">
            Número Conectado
          </p>
          <span className="text-2xl serif-italic text-slate-900 tracking-tight block mb-2">
            {isConnected ? formatPhone(status?.phoneNumber) : "—"}
          </span>
          <p className="text-[10px] mono-data text-slate-500 font-bold">
            {isConnected ? "Número vinculado ao bot" : "Nenhum número conectado"}
          </p>
        </div>

        {/* Uptime / Messages */}
        <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-5 sm:p-8 lg:p-10 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity text-slate-900">
            <Activity className="w-28 h-28" />
          </div>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em] mb-6">
            Uptime
          </p>
          <span className="text-2xl serif-italic text-slate-900 tracking-tight block mb-2">
            {isConnected ? formatUptime(status?.uptime) : "—"}
          </span>
          <p className="text-[10px] mono-data text-slate-500 font-bold">
            {isConnected && status?.messagesHandled !== undefined
              ? `${status.messagesHandled} mensagens processadas`
              : "Sem dados de atividade"}
          </p>
        </div>
      </motion.div>

      {/* Main Panel */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        {isConnected ? (
          /* ── Connected State ── */
          <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-6 sm:p-10 lg:p-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
              <div>
                <h3 className="text-[9px] font-bold text-slate-900 uppercase tracking-[0.3em] mb-2">
                  Sessão Ativa
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  O WhatsApp está conectado e processando mensagens normalmente.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">
                  Online
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-1">
                    Dispositivo
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatPhone(status?.phoneNumber)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-1">
                    Tempo Online
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatUptime(status?.uptime)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-500 shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-1">
                    Mensagens
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {status?.messagesHandled ?? 0} processadas
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-[10px] text-slate-400 font-medium max-w-md">
                Para desconectar a sessão, clique no botão ao lado. O número
                será desvinculado e será necessário escanear o QR Code
                novamente.
              </p>
              <button
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="bg-rose-50 text-rose-600 px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Power className="w-4 h-4" />
                {disconnectMutation.isPending
                  ? "Desconectando..."
                  : "Desconectar"}
              </button>
            </div>
          </div>
        ) : (
          /* ── Disconnected State — QR Code ── */
          <div className="exec-card rounded-2xl sm:rounded-[2.5rem] lg:rounded-[3rem] p-6 sm:p-10 lg:p-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
              <div>
                <h3 className="text-[9px] font-bold text-slate-900 uppercase tracking-[0.3em] mb-2">
                  Conectar WhatsApp
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  Escaneie o QR Code com o WhatsApp para vincular o dispositivo.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-[9px] font-bold text-rose-600 uppercase tracking-widest">
                  Offline
                </span>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-12">
              {/* QR Code */}
              <div className="flex flex-col items-center gap-6">
                <div className="relative w-64 h-64 bg-white rounded-3xl border-2 border-slate-100 flex items-center justify-center overflow-hidden shadow-sm">
                  {loadingQr ? (
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
                      <p className="text-[10px] text-slate-400 font-medium">
                        Gerando QR Code...
                      </p>
                    </div>
                  ) : qrData?.qrCode ? (
                    <img
                      src={
                        qrData.qrCode.startsWith("data:")
                          ? qrData.qrCode
                          : `data:image/png;base64,${qrData.qrCode}`
                      }
                      alt="WhatsApp QR Code"
                      className="w-56 h-56 object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3 px-6 text-center">
                      <QrCode className="w-12 h-12 text-slate-200" />
                      <p className="text-[10px] text-slate-400 font-medium">
                        {qrData?.message || "QR Code não disponível. Clique em Atualizar."}
                      </p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => refetchQr()}
                  className="bg-slate-100 text-slate-600 px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Atualizar QR
                </button>
              </div>

              {/* Instructions + Pairing Code */}
              <div className="flex-1 space-y-8">
                <div className="space-y-4">
                  <h4 className="text-[9px] font-bold text-slate-900 uppercase tracking-[0.3em]">
                    Como Conectar
                  </h4>
                  <ol className="space-y-3">
                    {[
                      "Abra o WhatsApp no seu celular",
                      "Toque em Menu (⋮) ou Configurações",
                      "Selecione \"Dispositivos vinculados\"",
                      "Toque em \"Vincular dispositivo\"",
                      "Aponte a câmera para o QR Code ao lado",
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="text-sm text-slate-600 font-medium">
                          {step}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Pairing Code */}
                {qrData?.pairingCode && (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <h4 className="text-[9px] font-bold text-slate-900 uppercase tracking-[0.3em] mb-3">
                      Ou Use o Código de Pareamento
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium mb-4">
                      No WhatsApp, toque em &quot;Vincular com número de
                      telefone&quot; e insira o código abaixo:
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="bg-white border-2 border-slate-200 rounded-xl px-6 py-3 tracking-[0.5em] text-xl font-bold text-slate-900 mono-data">
                        {qrData.pairingCode}
                      </div>
                      <button
                        onClick={handleCopyPairingCode}
                        className={cn(
                          "p-3 rounded-xl border transition-all",
                          copied
                            ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                            : "bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300"
                        )}
                      >
                        {copied ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <Copy className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Warning */}
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-[10px] text-amber-700 font-medium">
                    <strong>Importante:</strong> Use um número de telefone
                    dedicado para o bot. Não use seu número pessoal. O celular
                    com o WhatsApp precisa estar conectado à internet.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
