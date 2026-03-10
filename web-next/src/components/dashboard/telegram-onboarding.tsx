"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, ExternalLink, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const TELEGRAM_BOT_URL = "https://t.me/facilita_finance_bot";

export function TelegramOnboarding() {
  const { usuario, atualizarPerfil } = useAuth();
  const [open, setOpen] = useState(false);
  const [verificando, setVerificando] = useState(false);

  const verificar = useCallback(async () => {
    setVerificando(true);
    try {
      await atualizarPerfil();
      const stored = localStorage.getItem("cf_user");
      if (stored && JSON.parse(stored).telegramVinculado) {
        toast.success("Telegram vinculado!");
        setOpen(false);
        return;
      }
      toast.info("Ainda não detectamos o vínculo. Abra o bot e compartilhe seu contato.");
    } catch {
      toast.error("Erro ao verificar");
    } finally {
      setVerificando(false);
    }
  }, [atualizarPerfil]);

  if (!usuario || usuario.telegramVinculado) return null;

  return (
    <div className="fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-3">
      {/* Expanded panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="w-[calc(100vw-1.5rem)] sm:w-80 max-w-80 rounded-2xl border border-border/40 bg-card shadow-2xl shadow-black/10 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/30 bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <MessageCircle className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-bold">Conectar Telegram</span>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground/70 leading-relaxed">
                Registre gastos por áudio, foto ou texto direto no Telegram. A vinculação é
                automática pelo seu celular cadastrado.
              </p>

              {/* Step 1 */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                  1 Abra o bot
                </p>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 h-9 rounded-xl text-xs"
                >
                  <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                    @facilita_finance_bot
                  </a>
                </Button>
              </div>

              {/* Step 2 */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                  2 Compartilhe seu contato
                </p>
                <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
                  Ao abrir o bot, toque no botão &quot;Compartilhar meu contato&quot;. Seu celular
                  será comparado com o cadastrado aqui no sistema.
                </p>
              </div>

              {/* Confirm */}
              <Button
                size="sm"
                className="w-full rounded-xl h-9 gap-1.5 text-xs font-semibold btn-premium"
                onClick={verificar}
                loading={verificando}
              >
                <Check className="h-3.5 w-3.5" /> Já vinculei — confirmar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating pill trigger */}
      <motion.button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 rounded-full bg-emerald-500 pl-3.5 pr-4 py-2.5 text-white shadow-lg shadow-emerald-500/30 hover:bg-blue-600 transition-all duration-300 hover:shadow-emerald-500/40 hover:shadow-xl group"
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
