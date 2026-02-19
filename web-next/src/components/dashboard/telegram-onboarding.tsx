"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { api, type CodigoTelegramResponse } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

const TELEGRAM_BOT_URL = "https://t.me/facilita_finance_bot";

export function TelegramOnboarding() {
  const { usuario, atualizarPerfil } = useAuth();
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState<CodigoTelegramResponse | null>(null);
  const [gerando, setGerando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const gerarCodigo = useCallback(async () => {
    setGerando(true);
    try {
      const res = await api.auth.gerarCodigoTelegram();
      setCodigo(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar codigo");
    } finally {
      setGerando(false);
    }
  }, []);

  const verificar = useCallback(async () => {
    setVerificando(true);
    try {
      await atualizarPerfil();
      const stored = localStorage.getItem("cf_user");
      if (stored && JSON.parse(stored).telegramVinculado) {
        toast.success("Telegram vinculado! ");
        setOpen(false);
        return;
      }
      toast.info("Ainda nao detectamos o vinculo. Envie o comando e tente novamente.");
    } catch {
      toast.error("Erro ao verificar");
    } finally {
      setVerificando(false);
    }
  }, [atualizarPerfil]);

  const copiar = () => {
    if (!codigo) return;
    navigator.clipboard.writeText(`/vincular ${codigo.codigo}`);
    setCopiado(true);
    toast.success("Copiado!");
    setTimeout(() => setCopiado(false), 2000);
  };

  const handleOpen = () => {
    setOpen(true);
    if (!codigo && !gerando) gerarCodigo();
  };

  if (!usuario || usuario.telegramVinculado) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Expanded panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="w-80 rounded-2xl border border-border/40 bg-card shadow-2xl shadow-black/10 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/30 bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                  <MessageCircle className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-bold">Conectar Telegram</span>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground/70 leading-relaxed">
                Registre gastos por audio, foto ou texto direto no Telegram. Funciona 24h sem abrir o app.
              </p>

              {/* Step 1 */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">1  Abra o bot</p>
                <Button asChild variant="outline" size="sm" className="w-full gap-1.5 h-9 rounded-xl text-xs">
                  <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                    @facilita_finance_bot
                  </a>
                </Button>
              </div>

              {/* Step 2 */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">2  Envie o comando</p>
                {gerando ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Gerando codigo...
                  </div>
                ) : codigo ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <code className="flex-1 rounded-lg bg-muted px-2.5 py-2 text-xs font-mono font-bold select-all truncate">
                        /vincular {codigo.codigo}
                      </code>
                      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-lg" onClick={copiar}>
                        {copiado ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground/40">Expira em {formatDate(codigo.expiraEm)}</p>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full rounded-xl gap-1.5 h-9 text-xs" onClick={gerarCodigo}>
                    <RefreshCw className="h-3 w-3" />
                    Gerar codigo
                  </Button>
                )}
              </div>

              {/* Confirm */}
              <Button
                size="sm"
                className="w-full rounded-xl h-9 gap-1.5 text-xs font-semibold btn-premium"
                onClick={verificar}
                disabled={verificando || !codigo}
              >
                {verificando ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando...</>
                ) : (
                  <><Check className="h-3.5 w-3.5" /> Ja enviei  confirmar</>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating pill trigger */}
      <motion.button
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className="flex items-center gap-2.5 rounded-full bg-blue-500 pl-3.5 pr-4 py-2.5 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-all duration-300 hover:shadow-blue-500/40 hover:shadow-xl group"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="relative flex h-5 w-5 items-center justify-center">
          <span className="absolute h-full w-full rounded-full bg-white/25 animate-ping" />
          <MessageCircle className="h-4 w-4 relative" />
        </span>
        <span className="text-[13px] font-semibold">Conectar Telegram</span>
      </motion.button>
    </div>
  );
}
