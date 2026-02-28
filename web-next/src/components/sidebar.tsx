"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useAdminMode } from "@/contexts/admin-context";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  Landmark,
  Gauge,
  Target,
  User,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  CalendarClock,
  Brain,
  Wallet,
  Bell,
  Shield,
  Users,
  KeyRound,
  ShieldAlert,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const userNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lancamentos", label: "Lançamentos", icon: Receipt },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/contas-bancarias", label: "Contas", icon: Landmark },
  { href: "/contas-fixas", label: "Contas Fixas", icon: CalendarClock },
  { href: "/simulacao", label: "Consultor IA", icon: Brain },
  { href: "/limites", label: "Limites", icon: Gauge },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/perfil", label: "Perfil", icon: User },
];

const adminNavItems = [
  { href: "/admin", label: "Painel", icon: LayoutDashboard, exact: true },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/convites", label: "Convites", icon: KeyRound },
  { href: "/admin/seguranca", label: "Segurança", icon: ShieldAlert },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, isAdmin } = useAuth();
  const { isAdminMode } = useAdminMode();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const inAdmin = isAdmin && isAdminMode;
  const navItems = inAdmin ? adminNavItems : userNavItems;
  const accent = inAdmin ? "amber" : "emerald";

  useEffect(() => {
    setMounted(true);
    [...userNavItems, ...adminNavItems].forEach((item) => router.prefetch(item.href));
  }, [router]);

  /* ── helper: is this nav item active? ── */
  const isItemActive = (item: (typeof navItems)[number]) => {
    if ("exact" in item && item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  return (
    <>
      {/* ═══ Desktop Icon Sidebar ═══ */}
      <aside
        className={cn(
          "hidden lg:flex fixed left-0 top-0 bottom-0 w-20 sidebar-glass z-40 flex-col items-center py-8 gap-8",
          inAdmin && "border-r border-amber-500/15"
        )}
      >
        {/* Logo — green (user) or amber (admin) */}
        <Link
          href={inAdmin ? "/admin" : "/dashboard"}
          className={cn(
            "size-10 rounded-xl flex items-center justify-center shadow-lg shrink-0 hover:scale-105 transition-transform",
            inAdmin ? "bg-amber-500 shadow-amber-500/20" : "bg-emerald-600 shadow-emerald-600/20"
          )}
        >
          {inAdmin ? (
            <Shield className="h-5 w-5 text-black" />
          ) : (
            <Wallet className="h-5 w-5 text-white" />
          )}
        </Link>

        {/* Navigation */}
        <TooltipProvider delayDuration={0}>
          <AnimatePresence mode="wait">
            <motion.nav
              key={inAdmin ? "admin" : "user"}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-2 flex-1"
            >
              {navItems.map((item) => {
                const active = isItemActive(item);
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "relative size-12 rounded-2xl flex items-center justify-center transition-colors duration-200",
                          active
                            ? inAdmin
                              ? "text-black"
                              : "text-white"
                            : inAdmin
                              ? "text-slate-500 hover:bg-amber-500/10 hover:text-amber-400"
                              : "text-slate-400 dark:text-slate-500 hover:bg-white/80 dark:hover:bg-white/10 hover:text-emerald-600 dark:hover:text-emerald-600"
                        )}
                      >
                        {active && (
                          <motion.div
                            layoutId={inAdmin ? "sidebar-admin-pill" : "sidebar-user-pill"}
                            className={cn(
                              "absolute inset-0 rounded-2xl shadow-lg",
                              inAdmin
                                ? "bg-amber-500 shadow-amber-500/30"
                                : "bg-emerald-600 shadow-emerald-600/20"
                            )}
                            transition={{
                              type: "spring",
                              stiffness: 350,
                              damping: 30,
                            }}
                          />
                        )}
                        <item.icon className="h-5 w-5 relative z-10" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8} className="text-xs font-bold">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </motion.nav>
          </AnimatePresence>

          {/* ── Profile switch button ── */}
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={inAdmin ? "/dashboard" : "/admin"}
                  className={cn(
                    "relative size-12 rounded-2xl flex items-center justify-center transition-all duration-200 border-2 border-dashed",
                    inAdmin
                      ? "text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/50"
                      : "text-amber-500 border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500/50"
                  )}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="text-xs font-bold">
                {inAdmin ? "Voltar ao App" : "Administração"}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Bottom actions */}
          <div className="flex flex-col gap-2 mt-auto">
            {/* Theme toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => mounted && setTheme(theme === "dark" ? "light" : "dark")}
                  className={cn(
                    "size-12 rounded-2xl flex items-center justify-center transition-all duration-300 cursor-pointer",
                    inAdmin
                      ? "text-slate-500 hover:bg-amber-500/10 hover:text-amber-400"
                      : "text-slate-400 dark:text-slate-500 hover:bg-white/80 dark:hover:bg-white/10 hover:text-emerald-600"
                  )}
                >
                  {mounted && theme === "dark" ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="text-xs font-bold">
                {mounted && theme === "dark" ? "Modo Claro" : "Modo Escuro"}
              </TooltipContent>
            </Tooltip>

            {/* Logout */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={logout}
                  className="size-12 rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-300 cursor-pointer"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="text-xs font-bold">
                Sair
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </aside>

      {/* ═══ Mobile Header + Dialog Menu ═══ */}
      <header
        className={cn(
          "lg:hidden fixed top-0 left-0 right-0 z-50 h-14 px-4 flex items-center justify-between backdrop-blur-xl",
          inAdmin
            ? "bg-white dark:bg-[#161B22] border-b-2 border-amber-500/60"
            : "bg-white dark:bg-[#161B22] border-b border-slate-200/60 dark:border-white/5"
        )}
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl"
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
            <DialogContent
              className="fixed inset-y-0 left-0 w-72 p-0 rounded-none border-r-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl data-[state=open]:slide-in-from-left sm:max-w-72 [&>button]:hidden"
            >
              <DialogTitle className="sr-only">Menu de navegação</DialogTitle>
              <div className="flex h-full flex-col">
                {/* Logo */}
                <div
                  className={cn(
                    "flex items-center gap-3 px-5 py-6 border-b",
                    inAdmin ? "border-amber-500/20" : "border-slate-100 dark:border-slate-800"
                  )}
                >
                  <div
                    className={cn(
                      "size-10 rounded-xl flex items-center justify-center shadow-lg",
                      inAdmin
                        ? "bg-amber-500 shadow-amber-500/20"
                        : "bg-emerald-600 shadow-emerald-600/20"
                    )}
                  >
                    {inAdmin ? (
                      <Shield className="h-5 w-5 text-black" />
                    ) : (
                      <Wallet className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <div>
                    <h1 className="text-lg font-bold tracking-tight">
                      {inAdmin ? "Admin Panel" : "Control Finance"}
                    </h1>
                    {inAdmin && (
                      <p className="text-xs text-amber-500 font-semibold">Administração</p>
                    )}
                  </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                  {navItems.map((item) => {
                    const active = isItemActive(item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                          active
                            ? inAdmin
                              ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                              : "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}

                  {/* Switch profile button */}
                  {isAdmin && (
                    <>
                      <div
                        className={cn(
                          "h-px my-2 mx-1",
                          inAdmin ? "bg-emerald-500/20" : "bg-amber-500/20"
                        )}
                      />
                      <Link
                        href={inAdmin ? "/dashboard" : "/admin"}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 border border-dashed",
                          inAdmin
                            ? "text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
                            : "text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                        )}
                      >
                        <ArrowLeftRight className="h-5 w-5 shrink-0" />
                        {inAdmin ? "Voltar ao App" : "Administração"}
                      </Link>
                    </>
                  )}
                </nav>

                {/* Bottom */}
                <div className="p-4 space-y-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      if (mounted) setTheme(theme === "dark" ? "light" : "dark");
                    }}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 w-full transition-all cursor-pointer"
                  >
                    {mounted && theme === "dark" ? (
                      <Sun className="h-5 w-5" />
                    ) : (
                      <Moon className="h-5 w-5" />
                    )}
                    {mounted && theme === "dark" ? "Modo Claro" : "Modo Escuro"}
                  </button>
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      logout();
                    }}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 w-full transition-all cursor-pointer"
                  >
                    <LogOut className="h-5 w-5" />
                    Sair
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="flex items-center gap-2">
            <div
              className={cn(
                "size-8 rounded-lg flex items-center justify-center shadow-md",
                inAdmin
                  ? "bg-amber-500 shadow-amber-500/20"
                  : "bg-emerald-600 shadow-emerald-600/20"
              )}
            >
              {inAdmin ? (
                <Shield className="h-4 w-4 text-black" />
              ) : (
                <Wallet className="h-4 w-4 text-white" />
              )}
            </div>
            <span className="text-sm font-bold tracking-tight">
              {inAdmin ? "Admin Panel" : "Control Finance"}
            </span>
            {inAdmin && (
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500">
                Admin
              </span>
            )}
          </div>
        </div>

        <button className="relative p-2 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border border-white dark:border-slate-900" />
        </button>
      </header>
    </>
  );
}
