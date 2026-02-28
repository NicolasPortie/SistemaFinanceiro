"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginData } from "@/lib/schemas";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  Wallet,
  Shield,
  Zap,
  MoreHorizontal,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const { login, usuario } = useAuth();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (usuario) {
      router.replace("/dashboard");
    }
  }, [usuario, router]);

  if (usuario) {
    return null;
  }

  const onSubmit = async (data: LoginData) => {
    try {
      await login(data.email, data.senha);
      toast.success("Login realizado com sucesso!");
      router.replace("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao fazer login");
    }
  };

  return (
    <div className="bg-auth-gradient font-sans text-slate-900 dark:text-slate-100 antialiased min-h-screen overflow-y-auto relative">
      {/* Background blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-150 h-150 bg-emerald-500/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-125 h-125 bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 h-full w-full flex flex-col p-6 sm:p-8 lg:p-12">
        {/* Header / Logo */}
        <header className="flex items-center gap-3 text-white/90">
          <div className="size-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20 shadow-lg shadow-black/10">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-white text-xl font-bold tracking-tight">Control Finance</h2>
        </header>

        {/* Main content */}
        <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 xl:gap-24 w-full max-w-6xl mx-auto">
          {/* ── Left: Hero text (desktop) ── */}
          <div className="w-full lg:w-120 xl:w-135 shrink-0 text-center lg:text-left pt-8 lg:pt-0">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-white text-4xl sm:text-5xl lg:text-7xl font-black leading-tight tracking-[-0.03em] mb-6 lg:mb-8"
            >
              Suas <span className="whitespace-nowrap">finanças no</span> <br />
              <span className="text-emerald-300">controle total</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="text-emerald-100 text-base sm:text-lg lg:text-xl font-normal opacity-80 max-w-lg mx-auto lg:mx-0"
            >
              Dashboard e Metas em um só lugar. Acompanhe seu progresso com interfaces modernas e
              intuitivas.
            </motion.p>
          </div>

          {/* ── Right: Login card ── */}
          <div className="w-full lg:w-auto flex justify-center items-center py-8 lg:py-12">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="w-full max-w-110 login-glass-card p-7 sm:p-8 lg:p-10 rounded-3xl shadow-2xl relative overflow-hidden"
            >
              {/* Card header */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Bem-vindo de volta
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">
                  Acesse sua conta para gerenciar suas finanças.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* Email */}
                <div className="space-y-2">
                  <label
                    className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-0.5"
                    htmlFor="email"
                  >
                    Email
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                    </div>
                    <input
                      className="block w-full pl-11 pr-4 h-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 outline-none transition-all placeholder:text-slate-400"
                      id="email"
                      placeholder="exemplo@email.com"
                      type="email"
                      autoComplete="email"
                      {...register("email")}
                    />
                  </div>
                  {errors.email && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-red-500 pl-1 font-medium"
                    >
                      {errors.email.message}
                    </motion.p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-0.5">
                    <label
                      className="text-sm font-semibold text-slate-700 dark:text-slate-300"
                      htmlFor="senha"
                    >
                      Senha
                    </label>
                    <Link
                      href="/recuperar-senha"
                      className="text-xs font-semibold text-emerald-600 hover:underline"
                    >
                      Esqueceu sua senha?
                    </Link>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                    </div>
                    <input
                      className="block w-full pl-11 pr-12 h-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 outline-none transition-all placeholder:text-slate-400"
                      id="senha"
                      placeholder="••••••••"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      {...register("senha")}
                    />
                    <button
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.senha && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-red-500 pl-1 font-medium"
                    >
                      {errors.senha.message}
                    </motion.p>
                  )}
                </div>

                {/* Submit */}
                <button
                  className="w-full h-12 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-600/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 shadow-lg shadow-emerald-600/20 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Entrar
                      <LogIn className="h-5 w-5" />
                    </>
                  )}
                </button>
              </form>

              {/* Register link */}
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-center gap-2 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Não possui uma conta?</span>
                  <Link className="font-bold text-emerald-600 hover:underline" href="/registro">
                    Criar conta gratuita
                  </Link>
                </div>
              </div>

              {/* Trust badges */}
              <div className="mt-8 flex items-center justify-center gap-6">
                <div className="flex items-center gap-1 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
                  <Shield className="h-4 w-4 text-emerald-600" />
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                    Seguro
                  </span>
                </div>
                <div className="flex items-center gap-1 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
                  <Zap className="h-4 w-4 text-emerald-600" />
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                    Rápido
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-auto flex flex-col lg:flex-row items-end justify-between gap-8 pb-4 max-w-6xl mx-auto w-full">
          {/* Preview cards (desktop only) */}
          <div className="hidden lg:flex flex-row gap-6 w-full lg:w-2/3 auth-subtle-preview">
            {/* Dashboard preview */}
            <div className="auth-glass-card rounded-t-2xl p-5 flex-1 flex flex-col justify-between min-h-35 opacity-40 hover:opacity-100 transition-opacity duration-500">
              <div className="flex items-center justify-between mb-4">
                <span className="text-white font-semibold text-xs">Dashboard Mensal</span>
                <MoreHorizontal className="h-4 w-4 text-white/70" />
              </div>
              <div className="flex items-end gap-2 h-12">
                <div className="flex-1 bg-white/20 rounded-t-sm h-[40%]" />
                <div className="flex-1 bg-white/40 rounded-t-sm h-[70%]" />
                <div className="flex-1 bg-emerald-600/60 rounded-t-sm h-[90%] border-t border-white/30" />
                <div className="flex-1 bg-white/20 rounded-t-sm h-[55%]" />
                <div className="flex-1 bg-white/30 rounded-t-sm h-[30%]" />
              </div>
            </div>

            {/* Goals & Investment previews */}
            <div className="flex-1 flex flex-row gap-4">
              <div className="auth-glass-card rounded-t-2xl p-4 flex items-center gap-4 flex-1 opacity-40 hover:opacity-100 transition-opacity duration-500">
                <div className="size-10 rounded-full border-2 border-emerald-600 border-t-white/20 flex items-center justify-center">
                  <span className="text-[9px] text-white font-bold">85%</span>
                </div>
                <div>
                  <p className="text-white/60 text-[9px] uppercase font-bold tracking-wider">
                    Metas
                  </p>
                  <p className="text-white text-xs font-semibold">Reserva</p>
                </div>
              </div>
              <div className="auth-glass-card rounded-t-2xl p-4 flex items-center gap-4 flex-1 opacity-40 hover:opacity-100 transition-opacity duration-500">
                <div className="size-10 rounded-full border-2 border-green-400 border-t-white/20 flex items-center justify-center">
                  <span className="text-[9px] text-white font-bold">42%</span>
                </div>
                <div>
                  <p className="text-white/60 text-[9px] uppercase font-bold tracking-wider">
                    Investimento
                  </p>
                  <p className="text-white text-xs font-semibold">Ações</p>
                </div>
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="w-full lg:w-1/3 flex flex-col items-center lg:items-end justify-center h-full">
            <p className="text-white/30 text-[10px] tracking-wide mb-2 uppercase">
              © {new Date().getFullYear()} Control Finance Inc. Todos os direitos reservados.
            </p>
            <p className="text-white/40 text-[10px] flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Sua conexão é segura e criptografada ponta-a-ponta.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
