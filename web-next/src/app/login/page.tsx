"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginData } from "@/lib/schemas";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  TrendingUp,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  Wallet,
  PieChart,
  Bot,
  Target,
  CreditCard,
  Shield,
  Zap,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { login, usuario } = useAuth();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
  });

  if (usuario) {
    router.replace("/dashboard");
    return null;
  }

  const onSubmit = async (data: LoginData) => {
    try {
      await login(data.email, data.senha);
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao fazer login");
    }
  };

  return (
    <div className="flex min-h-svh bg-background">
      {/* ════════════════════════════════════════════
          LEFT PANEL — Desktop only
         ════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[42%] relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-linear-to-br from-emerald-950 via-teal-900 to-cyan-950" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />

        {/* Animated floating orbs */}
        <motion.div
          className="absolute top-[12%] right-[15%] w-72 h-72 rounded-full bg-emerald-400/8 blur-3xl"
          animate={{ y: [0, -30, 0], x: [0, 15, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[18%] left-[8%] w-56 h-56 rounded-full bg-teal-400/6 blur-3xl"
          animate={{ y: [0, 20, 0], x: [0, -10, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <motion.div
          className="absolute top-[48%] left-[45%] w-40 h-40 rounded-full bg-cyan-400/5 blur-3xl"
          animate={{ y: [0, -15, 0], x: [0, 20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        />

        {/* Geometric accent lines */}
        <div className="absolute top-[18%] right-10 w-px h-36 bg-linear-to-b from-transparent via-emerald-400/25 to-transparent" />
        <div className="absolute bottom-[28%] left-14 w-24 h-px bg-linear-to-r from-transparent via-teal-400/25 to-transparent" />
        <div className="absolute top-[55%] right-20 w-16 h-px bg-linear-to-r from-transparent via-cyan-400/15 to-transparent" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-linear-to-bl from-emerald-400/8 to-transparent rounded-bl-full" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-linear-to-tr from-cyan-400/6 to-transparent rounded-tr-full" />

        <div className="relative flex flex-col justify-between p-10 xl:p-14 text-white w-full z-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/8 border border-white/10 backdrop-blur-sm shadow-lg shadow-black/10">
              <TrendingUp className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight leading-none">ControlFinance</span>
              <span className="text-[10px] text-emerald-300/50 font-medium tracking-[0.15em] uppercase mt-0.5">Financial Platform</span>
            </div>
          </div>

          {/* Hero content */}
          <div className="space-y-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.7 }}
            >
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-400/8 border border-emerald-400/15 mb-7">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] text-emerald-300/80 font-semibold tracking-wide">Plataforma ativa</span>
              </div>

              <h2 className="text-[2rem] xl:text-[2.5rem] font-extrabold leading-[1.1] tracking-tight">
                Suas finanças no
                <br />
                <span className="bg-linear-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
                  controle total.
                </span>
              </h2>
              <p className="mt-5 text-[14px] text-white/35 leading-relaxed max-w-[340px]">
                Gestão inteligente com dashboards em tempo real, IA integrada e análises que impulsionam suas decisões financeiras.
              </p>
            </motion.div>

            {/* Feature cards */}
            <div className="space-y-2">
              {[
                { icon: PieChart, label: "Dashboard completo", detail: "Gráficos e métricas em tempo real" },
                { icon: Bot, label: "IA no Telegram", detail: "Registre gastos por voz ou texto" },
                { icon: Target, label: "Metas inteligentes", detail: "Acompanhe progresso automaticamente" },
                { icon: CreditCard, label: "Cartões e faturas", detail: "Controle total de múltiplos cartões" },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="group flex items-center gap-3.5 py-3 px-3.5 -mx-3.5 rounded-2xl hover:bg-white/[0.04] transition-all duration-300 hover:-translate-y-px"
                >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.06] group-hover:bg-white/[0.08] group-hover:border-emerald-400/15 group-hover:shadow-lg group-hover:shadow-emerald-500/5 transition-all duration-300">
                    <item.icon className="h-4 w-4 text-emerald-400/70 group-hover:text-emerald-300 transition-colors" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-white/85">{item.label}</p>
                    <p className="text-[11px] text-white/30">{item.detail}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-white/[0.06]">
            <p className="text-[11px] text-white/20">© {new Date().getFullYear()} ControlFinance</p>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          RIGHT PANEL — Form
         ════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Subtle background blobs */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-emerald-500/[0.03] dark:bg-emerald-500/[0.05] blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-teal-500/[0.03] dark:bg-teal-500/[0.05] blur-[100px] pointer-events-none" />

        {/* ── Mobile Hero Header ── */}
        <div className="lg:hidden relative overflow-hidden">
          <div className="bg-linear-to-br from-emerald-950 via-teal-900 to-cyan-950 px-6 pt-safe-top relative">
            <div className="pt-8 pb-10">
              {/* Mobile orbs */}
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-emerald-400/10 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-teal-400/8 blur-3xl" />

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 border border-white/10 backdrop-blur-sm">
                    <TrendingUp className="h-5 w-5 text-emerald-300" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-white tracking-tight leading-none">ControlFinance</span>
                    <span className="text-[9px] text-emerald-300/50 font-medium tracking-[0.15em] uppercase mt-0.5">Financial Platform</span>
                  </div>
                </div>
                <h2 className="text-xl font-bold text-white/90 tracking-tight">
                  Bem-vindo de volta
                </h2>
                <p className="text-[13px] text-white/35 mt-1.5 max-w-xs">
                  Acesse sua conta e gerencie suas finanças
                </p>
              </div>
            </div>
          </div>
          {/* Curved bottom edge */}
          <div className="h-5 bg-background relative -mt-5 rounded-t-[1.5rem]" />
        </div>

        {/* ── Form Area ── */}
        <div className="flex flex-1 items-center justify-center px-5 py-6 sm:px-8 lg:px-12 lg:py-0">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full max-w-[420px]"
          >
            {/* Desktop header */}
            <div className="hidden lg:block mb-10">
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-[1.85rem] font-extrabold tracking-tight text-foreground"
              >
                Acessar conta
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mt-2 text-[14px] text-muted-foreground/70"
              >
                Informe suas credenciais para continuar
              </motion.p>
            </div>

            {/* Mobile header (below gradient strip) */}
            <div className="lg:hidden mb-6">
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                Entrar na conta
              </h1>
              <p className="mt-1.5 text-[13px] text-muted-foreground/70">
                Informe suas credenciais para continuar
              </p>
            </div>

            {/* ── Form ── */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Email */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-2"
              >
                <label htmlFor="email" className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.12em]">
                  E-mail
                </label>
                <div
                  className={`relative rounded-xl border-2 transition-all duration-300 ${
                    focusedField === "email"
                      ? "border-emerald-500/50 ring-4 ring-emerald-500/8 shadow-lg shadow-emerald-500/5"
                      : errors.email
                        ? "border-red-400/50 ring-4 ring-red-500/5"
                        : "border-border/50 hover:border-border/80"
                  }`}
                >
                  <Mail
                    className={`absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] transition-all duration-300 ${
                      focusedField === "email" ? "text-emerald-500 scale-110" : "text-muted-foreground/40"
                    }`}
                  />
                  <Input
                    id="email"
                    type="email"
                    placeholder="nome@exemplo.com"
                    className="pl-12 h-[52px] border-0 bg-transparent shadow-none focus-visible:ring-0 text-[15px] placeholder:text-muted-foreground/30 font-medium"
                    autoComplete="email"
                    {...register("email")}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                  />
                </div>
                {errors.email && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-500 pl-1 font-medium">
                    {errors.email.message}
                  </motion.p>
                )}
              </motion.div>

              {/* Password */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <label htmlFor="senha" className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.12em]">
                    Senha
                  </label>
                  <Link
                    href="/recuperar-senha"
                    className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 font-semibold transition-colors"
                  >
                    Esqueceu a senha?
                  </Link>
                </div>
                <div
                  className={`relative rounded-xl border-2 transition-all duration-300 ${
                    focusedField === "senha"
                      ? "border-emerald-500/50 ring-4 ring-emerald-500/8 shadow-lg shadow-emerald-500/5"
                      : errors.senha
                        ? "border-red-400/50 ring-4 ring-red-500/5"
                        : "border-border/50 hover:border-border/80"
                  }`}
                >
                  <Lock
                    className={`absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] transition-all duration-300 ${
                      focusedField === "senha" ? "text-emerald-500 scale-110" : "text-muted-foreground/40"
                    }`}
                  />
                  <Input
                    id="senha"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-12 pr-12 h-[52px] border-0 bg-transparent shadow-none focus-visible:ring-0 text-[15px] placeholder:text-muted-foreground/30 font-medium"
                    autoComplete="current-password"
                    {...register("senha")}
                    onFocus={() => setFocusedField("senha")}
                    onBlur={() => setFocusedField(null)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-foreground/60 transition-colors p-1"
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.senha && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-500 pl-1 font-medium">
                    {errors.senha.message}
                  </motion.p>
                )}
              </motion.div>

              {/* Submit */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="pt-1"
              >
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-[52px] text-[15px] font-bold rounded-2xl bg-linear-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:via-teal-500 hover:to-emerald-500 text-white shadow-lg shadow-emerald-600/25 hover:shadow-2xl hover:shadow-emerald-500/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 border-0 gap-2.5 group cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      Entrar
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </Button>
              </motion.div>
            </form>

            {/* Divider */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="my-8 flex items-center gap-4"
            >
              <div className="flex-1 h-px bg-linear-to-r from-transparent via-border/60 to-transparent" />
              <span className="text-[11px] text-muted-foreground/40 font-semibold">Não tem conta?</span>
              <div className="flex-1 h-px bg-linear-to-r from-transparent via-border/60 to-transparent" />
            </motion.div>

            {/* Register link */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
              <Link href="/registro">
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-2xl text-sm font-semibold border-border/40 hover:border-emerald-500/30 hover:bg-emerald-500/[0.03] hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 gap-2 cursor-pointer"
                >
                  <Wallet className="h-4 w-4" />
                  Criar conta com convite
                </Button>
              </Link>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-8 flex items-center justify-center gap-3 sm:gap-4 flex-wrap"
            >
              {[
                { icon: Shield, text: "SSL Seguro" },
                { icon: Zap, text: "Login rápido" },
                { icon: Sparkles, text: "IA integrada" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40 font-medium">
                  <item.icon className="h-3 w-3" />
                  <span>{item.text}</span>
                </div>
              ))}
            </motion.div>

            {/* Footer */}
            <p className="mt-6 text-center text-[10px] text-muted-foreground/35">
              Ao entrar, você concorda com os termos de uso da plataforma.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
