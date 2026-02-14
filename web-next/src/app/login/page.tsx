"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginData } from "@/lib/schemas";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState } from "react";

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
    <div className="flex min-h-screen bg-[#fafbfc] dark:bg-[#0a0b0f]">
      {/* ─── Painel Esquerdo ─── */}
      <div className="hidden lg:flex lg:w-130 xl:w-145 relative overflow-hidden">
        {/* Background com gradiente único */}
        <div className="absolute inset-0 bg-linear-to-br from-emerald-950 via-teal-900 to-cyan-950" />

        {/* Grid pattern sutil */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Elementos decorativos geométricos */}
        <div className="absolute top-0 right-0 w-100 h-100 bg-linear-to-bl from-emerald-400/10 to-transparent rounded-bl-full" />
        <div className="absolute bottom-0 left-0 w-75 h-75 bg-linear-to-tr from-cyan-400/8 to-transparent rounded-tr-full" />

        {/* Linhas decorativas */}
        <div className="absolute top-[20%] right-12 w-px h-32 bg-linear-to-b from-transparent via-emerald-400/30 to-transparent" />
        <div className="absolute bottom-[25%] left-16 w-24 h-px bg-linear-to-r from-transparent via-teal-400/30 to-transparent" />

        <div className="relative flex flex-col justify-between p-10 xl:p-12 text-white w-full z-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 border border-white/10 backdrop-blur-sm">
              <TrendingUp className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight leading-none">ControlFinance</span>
              <span className="text-[10px] text-emerald-300/60 font-medium tracking-widest uppercase">Financial Platform</span>
            </div>
          </div>

          {/* Conteúdo central */}
          <div className="space-y-10 -mt-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.7 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/20 mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-300 font-medium">Plataforma ativa</span>
              </div>

              <h2 className="text-[2rem] xl:text-[2.25rem] font-bold leading-[1.15] tracking-tight">
                Suas finanças no
                <br />
                <span className="bg-linear-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
                  controle total.
                </span>
              </h2>
              <p className="mt-4 text-[15px] text-white/50 leading-relaxed max-w-sm">
                Gestão inteligente com dashboards em tempo real, IA integrada e
                análises que impulsionam decisões.
              </p>
            </motion.div>

            {/* Feature cards compactos */}
            <div className="space-y-3">
              {[
                { icon: PieChart, label: "Dashboard completo", detail: "Gráficos e métricas em tempo real" },
                { icon: Bot, label: "IA no Telegram", detail: "Registre gastos por voz ou texto" },
                { icon: Target, label: "Metas inteligentes", detail: "Acompanhe o progresso automaticamente" },
                { icon: CreditCard, label: "Cartões e faturas", detail: "Controle total de múltiplos cartões" },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
                  className="group flex items-center gap-3.5 py-2.5 px-3 -mx-3 rounded-xl hover:bg-white/4 transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/6 border border-white/6 group-hover:border-emerald-400/20 transition-colors">
                    <item.icon className="h-4 w-4 text-emerald-400/80" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white/90">{item.label}</p>
                    <p className="text-xs text-white/35">{item.detail}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Rodapé */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-white/25">
              © {new Date().getFullYear()} ControlFinance
            </p>
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-emerald-400/40" />
              <div className="w-1 h-1 rounded-full bg-teal-400/40" />
              <div className="w-1 h-1 rounded-full bg-cyan-400/40" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Painel Direito - Formulário ─── */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-8 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute -top-40 -right-40 w-125 h-125 rounded-full bg-emerald-500/2 dark:bg-emerald-500/3 blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 w-100 h-100 rounded-full bg-teal-500/2 dark:bg-teal-500/3 blur-[100px]" />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-105 relative z-10"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Control<span className="text-emerald-600 dark:text-emerald-400">Finance</span>
            </span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-[1.75rem] font-bold tracking-tight text-foreground">
              Acessar conta
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Informe suas credenciais para continuar
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-[13px] font-semibold text-foreground/80 uppercase tracking-wider">
                E-mail
              </label>
              <div className={`relative rounded-xl border transition-all duration-200 ${
                focusedField === "email"
                  ? "border-emerald-500/50 ring-[3px] ring-emerald-500/10 dark:ring-emerald-400/10"
                  : errors.email
                    ? "border-red-400/50"
                    : "border-border hover:border-border/80"
              }`}>
                <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 transition-colors ${
                  focusedField === "email" ? "text-emerald-500 dark:text-emerald-400" : "text-muted-foreground/50"
                }`} />
                <Input
                  id="email"
                  type="email"
                  placeholder="nome@exemplo.com"
                  className="pl-11 h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 text-[15px] placeholder:text-muted-foreground/40"
                  autoComplete="email"
                  {...register("email")}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-500 pl-1">{errors.email.message}</p>
              )}
            </div>

            {/* Senha */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="senha" className="text-[13px] font-semibold text-foreground/80 uppercase tracking-wider">
                  Senha
                </label>
                <Link
                  href="/recuperar-senha"
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors"
                >
                  Esqueceu?
                </Link>
              </div>
              <div className={`relative rounded-xl border transition-all duration-200 ${
                focusedField === "senha"
                  ? "border-emerald-500/50 ring-[3px] ring-emerald-500/10 dark:ring-emerald-400/10"
                  : errors.senha
                    ? "border-red-400/50"
                    : "border-border hover:border-border/80"
              }`}>
                <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 transition-colors ${
                  focusedField === "senha" ? "text-emerald-500 dark:text-emerald-400" : "text-muted-foreground/50"
                }`} />
                <Input
                  id="senha"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-11 pr-11 h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 text-[15px] placeholder:text-muted-foreground/40"
                  autoComplete="current-password"
                  {...register("senha")}
                  onFocus={() => setFocusedField("senha")}
                  onBlur={() => setFocusedField(null)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground/70 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.senha && (
                <p className="text-xs text-red-500 pl-1">{errors.senha.message}</p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-12 text-[15px] font-semibold rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-500/25 transition-all duration-300 border-0 gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-8 flex items-center gap-4">
            <div className="flex-1 h-px bg-linear-to-r from-transparent via-border to-transparent" />
            <span className="text-xs text-muted-foreground/60 font-medium">Não tem conta?</span>
            <div className="flex-1 h-px bg-linear-to-r from-transparent via-border to-transparent" />
          </div>

          {/* Registro link */}
          <Link href="/registro" className="block">
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl text-sm font-medium border-border/60 hover:border-emerald-500/30 hover:bg-emerald-500/3 transition-all duration-200 gap-2"
            >
              <Wallet className="h-4 w-4" />
              Criar conta com convite
            </Button>
          </Link>

          {/* Footer */}
          <p className="mt-8 text-center text-[11px] text-muted-foreground/40">
            Ao entrar, você concorda com os termos de uso da plataforma.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
