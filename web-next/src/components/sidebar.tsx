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
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useTheme } from "next-themes";
import { useState } from "react";
import { motion } from "framer-motion";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lancamentos", label: "Lançamentos", icon: Receipt },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/simulacao", label: "Simulação", icon: ShoppingCart },
  { href: "/limites", label: "Limites", icon: Gauge },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/perfil", label: "Perfil", icon: User },
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
              ? "bg-primary/8 text-primary dark:bg-primary/12 shadow-sm shadow-primary/5"
              : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          )}
        >
          {isActive && (
            <motion.div
              layoutId="sidebar-indicator"
              className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
              style={{ boxShadow: "0 0 12px oklch(0.68 0.19 160 / 0.5), 0 0 4px oklch(0.68 0.19 160 / 0.3)" }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <Icon
            className={cn(
              "h-[18px] w-[18px] shrink-0 transition-all duration-300",
              isActive ? "scale-110" : "group-hover:scale-105"
            )}
          />
          <span className="truncate">{label}</span>
          {isActive && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary animate-pulse-subtle" />
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
  const { usuario, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl gradient-primary shadow-lg shadow-emerald-500/30">
          <TrendingUp className="h-5 w-5 text-white" />
          <div className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card">
            <div className="h-full w-full rounded-full bg-emerald-400 animate-pulse-subtle" />
          </div>
        </div>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">
            Control<span className="text-gradient">Finance</span>
          </h1>
          <p className="text-[10px] text-muted-foreground/60 -mt-0.5 flex items-center gap-1 font-medium tracking-wider uppercase">
            <Sparkles className="h-2.5 w-2.5" />
            Premium
          </p>
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
        </TooltipProvider>
      </nav>

      <div className="mx-5 divider-premium" />

      {/* Footer */}
      <div className="p-4 space-y-3">
        {/* Theme toggle */}
        <div className="flex items-center gap-1 rounded-xl bg-muted/40 p-1 border border-border/30">
          <button
            onClick={() => setTheme("light")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all duration-300",
              theme === "light"
                ? "bg-card text-foreground shadow-md shadow-black/5"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sun className="h-3.5 w-3.5" />
            Claro
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all duration-300",
              theme === "dark"
                ? "bg-card text-foreground shadow-md shadow-black/5"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Moon className="h-3.5 w-3.5" />
            Escuro
          </button>
        </div>

        {/* User card */}
        {usuario && (
          <div className="relative overflow-hidden rounded-xl p-3.5 border border-primary/10 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent">
            {/* Decorative corner */}
            <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-primary/5" />

            <div className="relative flex items-center gap-3">
              <Avatar className="h-10 w-10 border-2 border-primary/20 shadow-lg shadow-primary/10">
                <AvatarFallback className="bg-gradient-to-br from-primary/15 to-primary/25 text-primary text-xs font-extrabold">
                  {getInitials(usuario.nome)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{usuario.nome}</p>
                <p className="text-[11px] text-muted-foreground/70 truncate">
                  {usuario.email}
                </p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 shrink-0 transition-all duration-300"
                      onClick={logout}
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
      </div>
    </div>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-65 lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 border-r border-border/30 bg-card/70 backdrop-blur-2xl noise-overlay">
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 flex h-14 items-center gap-3 border-b border-border/30 glass-premium px-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
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
