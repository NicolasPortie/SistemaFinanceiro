"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { api, type CodigoTelegramResponse } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  Mic,
  Camera,
  BarChart3,
  CreditCard,
  Bell,
  ArrowRight,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  ExternalLink,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

const ONBOARDING_KEY = "cf_onboarding_seen";
const TELEGRAM_BOT_URL = "https://t.me/facilita_finance_bot";

type Step = "welcome" | "features" | "connect";

const features = [
  {
    icon: Mic,
    title: "Áudio inteligente",
    desc: "Envie um áudio como \"gastei 50 no mercado\" e o bot registra automaticamente.",
    color: "text-violet-500 bg-violet-500/10",
  },
  {
    icon: Camera,
    title: "Foto de comprovante",
    desc: "Tire foto de um recibo ou nota fiscal — a IA extrai valor, categoria e descrição.",
    color: "text-blue-500 bg-blue-500/10",
  },
  {
    icon: MessageCircle,
    title: "Texto natural",
    desc: "Escreva \"paguei 200 de luz\" ou \"recebi 3000 de salário\" em linguagem natural.",
    color: "text-emerald-500 bg-emerald-500/10",
  },
  {
    icon: BarChart3,
    title: "Consultas rápidas",
    desc: "Pergunte \"quanto gastei esse mês?\" ou \"qual meu saldo?\" e receba na hora.",
    color: "text-amber-500 bg-amber-500/10",
  },
  {
    icon: CreditCard,
    title: "Faturas de cartão",
    desc: "Veja faturas, parcelas pendentes e limite disponível direto na conversa.",
    color: "text-rose-500 bg-rose-500/10",
  },
  {
    icon: Bell,
    title: "Lembretes automáticos",
    desc: "Receba alertas de vencimentos, limites estourados e metas próximas de acabar.",
    color: "text-cyan-500 bg-cyan-500/10",
  },
];

export function TelegramOnboarding() {
  const { usuario, atualizarPerfil } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [codigoTelegram, setCodigoTelegram] = useState<CodigoTelegramResponse | null>(null);
  const [gerando, setGerando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    // Show onboarding if user hasn't linked Telegram AND hasn't dismissed this before
    if (!usuario.telegramVinculado && !localStorage.getItem(ONBOARDING_KEY)) {
      // Small delay so it doesn't flash immediately
      const timer = setTimeout(() => setOpen(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [usuario]);

  const handleClose = () => {
    setOpen(false);
    localStorage.setItem(ONBOARDING_KEY, "1");
  };

  const gerarCodigo = useCallback(async () => {
    setGerando(true);
    try {
      const res = await api.auth.gerarCodigoTelegram();
      setCodigoTelegram(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar código");
    } finally {
      setGerando(false);
    }
  }, []);

  const verificarVinculo = useCallback(async () => {
    setVerificando(true);
    try {
      await atualizarPerfil();
      // Check updated user
      const stored = localStorage.getItem("cf_user");
      if (stored) {
        const u = JSON.parse(stored);
        if (u.telegramVinculado) {
          toast.success("Telegram vinculado com sucesso! 🎉");
          localStorage.setItem(ONBOARDING_KEY, "1");
          setOpen(false);
          return;
        }
      }
      toast.info("Ainda não detectamos o vínculo. Envie o comando no bot e tente novamente.");
    } catch {
      toast.error("Erro ao verificar vínculo");
    } finally {
      setVerificando(false);
    }
  }, [atualizarPerfil]);

  const copiarCodigo = useCallback(() => {
    if (!codigoTelegram) return;
    navigator.clipboard.writeText(`/vincular ${codigoTelegram.codigo}`);
    setCopiado(true);
    toast.success("Comando copiado!");
    setTimeout(() => setCopiado(false), 2000);
  }, [codigoTelegram]);

  if (!usuario || usuario.telegramVinculado) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden border-0 shadow-2xl [&>button]:hidden">
        <AnimatePresence mode="wait">
          {/* ══════════ Step 1: Welcome ══════════ */}
          {step === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="relative"
            >
              {/* Hero gradient */}
              <div className="relative h-44 overflow-hidden bg-linear-to-br from-blue-600 via-indigo-600 to-violet-700">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.12),transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(255,255,255,0.06),transparent_50%)]" />
                {/* Telegram icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 animate-ping rounded-full bg-white/10 scale-150" />
                    <div className="relative h-20 w-20 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
                      <MessageCircle className="h-10 w-10 text-white" />
                    </div>
                  </div>
                </div>
                {/* Close */}
                <button onClick={handleClose} className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer backdrop-blur-sm">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-6 pb-6 pt-5 space-y-4 text-center">
                <div className="space-y-2">
                  <h2 className="text-2xl font-extrabold tracking-tight">
                    Bem-vindo ao ControlFinance!
                  </h2>
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
                    Sua conta foi criada com sucesso. Conecte seu <strong>Telegram</strong> para desbloquear o poder total do sistema.
                  </p>
                </div>

                <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/30 p-4 text-left">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-[13px] font-semibold text-blue-900 dark:text-blue-300">
                        O que é o bot do Telegram?
                      </p>
                      <p className="text-xs text-blue-800/80 dark:text-blue-400/70 leading-relaxed">
                        É um assistente com inteligência artificial que registra seus gastos e receitas por <strong>áudio, texto ou foto</strong> direto no Telegram. Funciona 24h, sem abrir o app.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={handleClose}>
                    Fazer depois
                  </Button>
                  <Button className="flex-1 rounded-xl h-11 gap-2 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-blue-500/20" onClick={() => setStep("features")}>
                    Ver o que faz
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════════ Step 2: Features ══════════ */}
          {step === "features" && (
            <motion.div
              key="features"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <div className="px-6 pt-6 pb-2 flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-lg font-extrabold tracking-tight">O que o bot faz por você</h2>
                  <p className="text-xs text-muted-foreground">Tudo isso direto na conversa do Telegram</p>
                </div>
                <button onClick={handleClose} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-6 py-3 grid grid-cols-1 gap-2.5 max-h-85 overflow-y-auto">
                {features.map((f, i) => (
                  <motion.div
                    key={f.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-start gap-3 rounded-xl border border-border/30 bg-card/50 p-3.5 hover:bg-card/80 transition-colors"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${f.color}`}>
                      <f.icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold">{f.title}</p>
                      <p className="text-[11px] text-muted-foreground/70 leading-relaxed mt-0.5">{f.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="px-6 pb-6 pt-3">
                <Button className="w-full rounded-xl h-11 gap-2 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-lg shadow-emerald-500/20" onClick={() => { setStep("connect"); gerarCodigo(); }}>
                  Conectar agora
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ══════════ Step 3: Connect ══════════ */}
          {step === "connect" && (
            <motion.div
              key="connect"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <div className="px-6 pt-6 pb-2 flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-lg font-extrabold tracking-tight">Conectar Telegram</h2>
                  <p className="text-xs text-muted-foreground">Siga os 3 passos abaixo</p>
                </div>
                <button onClick={handleClose} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-6 py-4 space-y-4">
                {/* Step 1: Open bot */}
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-extrabold">1</div>
                  <div className="flex-1 space-y-2">
                    <p className="text-[13px] font-semibold">Abra o bot no Telegram</p>
                    <Button asChild variant="outline" size="sm" className="w-full gap-2 rounded-xl h-9">
                      <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir @facilita_finance_bot
                      </a>
                    </Button>
                  </div>
                </div>

                {/* Step 2: Send command */}
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-extrabold">2</div>
                  <div className="flex-1 space-y-2">
                    <p className="text-[13px] font-semibold">Envie este comando no bot</p>
                    {gerando ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Gerando código...
                      </div>
                    ) : codigoTelegram ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <code className="flex-1 rounded-lg bg-muted px-3 py-2.5 text-sm font-mono font-bold select-all">
                            /vincular {codigoTelegram.codigo}
                          </code>
                          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-lg" onClick={copiarCodigo}>
                            {copiado ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground/50">Expira em {formatDate(codigoTelegram.expiraEm)}</p>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full rounded-xl gap-2 h-9" onClick={gerarCodigo}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Gerar código
                      </Button>
                    )}
                  </div>
                </div>

                {/* Step 3: Verify */}
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-extrabold">3</div>
                  <div className="flex-1 space-y-2">
                    <p className="text-[13px] font-semibold">Confirme a vinculação</p>
                    <Button
                      className="w-full rounded-xl h-10 gap-2 font-semibold shadow-premium btn-premium"
                      onClick={verificarVinculo}
                      disabled={verificando || !codigoTelegram}
                    >
                      {verificando ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4" /> Já enviei, verificar</>}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-5">
                <p className="text-center text-[11px] text-muted-foreground/50">
                  Você pode fazer isso depois em <strong>Perfil → Telegram</strong>.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
