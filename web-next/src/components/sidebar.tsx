"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  ShoppingCart,
  Gauge,
  Target,
  User,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  TrendingUp,
  CalendarClock,
  Brain,
  Shield,
  Users,
  KeyRound,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lancamentos", label: "Lançamentos", icon: Receipt },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/contas-fixas", label: "Contas Fixas", icon: CalendarClock },
  { href: "/simulacao", label: "Simulação", icon: ShoppingCart },
  { href: "/decisao", label: "Consultor", icon: Brain },
  { href: "/limites", label: "Limites", icon: Gauge },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/perfil", label: "Perfil", icon: User },
];

const adminNavItems = [
  { href: "/admin", label: "Painel Admin", icon: Shield },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/convites", label: "Convites", icon: KeyRound },
  { href: "/admin/seguranca", label: "Segurança", icon: Lock },
];

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Link
          href={href}
          onClick={onClick}
          className={cn(
            "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium transition-all duration-300",
            isActive
              ? "bg-primary/6 text-primary dark:bg-primary/10 shadow-sm shadow-primary/3"
              : "text-muted-foreground/65 hover:bg-muted/50 hover:text-foreground"
          )}
        >
          {isActive && (
            <motion.div
              layoutId="sidebar-indicator"
              className="absolute left-0 top-1/2 h-6 w-0.75 -translate-y-1/2 rounded-r-full bg-linear-to-b from-primary to-primary/70"
              style={{ boxShadow: "0 0 12px oklch(0.7 0.19 160 / 0.35), 0 0 4px oklch(0.7 0.19 160 / 0.15)" }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <Icon
            className={cn(
              "h-4.5 w-4.5 shrink-0 transition-all duration-300",
              isActive ? "scale-105" : "group-hover:scale-105 group-hover:text-foreground/80"
            )}
          />
          <span className="truncate">{label}</span>
          {isActive && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary animate-pulse-subtle" />
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" className="lg:hidden">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { usuario, logout, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-7">
        <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl gradient-primary shadow-lg shadow-emerald-500/25 transition-transform duration-300 hover:scale-105">
          <TrendingUp className="h-5 w-5 text-white" />
          <div className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card">
            <div className="h-full w-full rounded-full bg-emerald-400 animate-pulse-subtle" />
          </div>
        </div>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">
            Control<span className="text-gradient">Finance</span>
          </h1>
          <p className="text-[10px] text-muted-foreground/40 -mt-0.5 font-medium tracking-wide">Controle financeiro</p>
        </div>
      </div>

      <div className="mx-5 divider-premium" />

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-4 overflow-y-auto">
        <TooltipProvider delayDuration={0}>
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              isActive={pathname === item.href}
              onClick={onNavigate}
            />
          ))}

          {isAdmin && (
            <>
              <div className="mx-2 my-3 divider-premium" />
              <p className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-500/80 flex items-center gap-1.5">
                <Shield className="h-3 w-3" />
                Administração
              </p>
              {adminNavItems.map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  isActive={pathname === item.href}
                  onClick={onNavigate}
                />
              ))}
            </>
          )}
        </TooltipProvider>
      </nav>

      <div className="mx-5 divider-premium" />

      {/* Footer */}
      <div className="p-4 space-y-3">
        {/* Theme toggle */}
        <div className="flex items-center justify-between rounded-xl bg-muted/25 px-4 py-3 border border-border/15 transition-colors hover:bg-muted/40">
          <div className="flex items-center gap-2.5">
            {mounted && theme === "dark" ? (
              <Moon className="h-4 w-4 text-primary animate-in fade-in zoom-in duration-300" />
            ) : (
              <Sun className="h-4 w-4 text-amber-500 animate-in fade-in zoom-in duration-300" />
            )}
            <span className="text-xs font-semibold text-muted-foreground/80">
              Modo Escuro
            </span>
          </div>
          {mounted && (
            <Switch
              checked={theme === "dark"}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              aria-label="Alternar modo escuro"
              className="data-[state=checked]:bg-primary"
            />
          )}
        </div>

        {/* User card */}
        {usuario && (
          <div className="relative overflow-hidden rounded-2xl p-3.5 border border-primary/6 bg-linear-to-br from-primary/3 via-primary/1 to-transparent">
            {/* Decorative corner */}
            <div className="absolute -right-4 -top-4 h-18 w-18 rounded-full bg-primary/3 blur-md" />

            <div className="relative flex items-center gap-3">
              <Avatar className="h-10 w-10 border-2 border-primary/12 shadow-lg shadow-primary/4 transition-transform duration-300 hover:scale-105">
                <AvatarFallback className="bg-linear-to-br from-primary/8 to-primary/18 text-primary text-xs font-extrabold">
                  {getInitials(usuario.nome)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{usuario.nome}</p>
                <p className="text-[10px] text-muted-foreground/50 truncate">
                  {usuario.email}
                </p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 shrink-0 transition-all duration-300"
                      onClick={logout}
                      aria-label="Sair"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Sair</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        )}

        <div className="mt-1 text-center">
          <p className="text-[10px] text-muted-foreground/30 font-mono tracking-widest">
            v1.11.0
          </p>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-65 lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 border-r border-border/15 bg-card/85 backdrop-blur-2xl backdrop-saturate-150">
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 flex h-14 items-center gap-3 border-b border-border/15 glass-premium px-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}>
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 border-r-0 bg-card/95 backdrop-blur-2xl">
            <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl gradient-primary shadow-md shadow-emerald-500/20">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-extrabold tracking-tight">
            Control<span className="text-gradient">Finance</span>
          </span>
        </div>
      </header>
    </>
  );
}
