"use client";

import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/contexts/auth-context";
import { useAdminMode, AdminContextProvider } from "@/contexts/admin-context";
import { getGreeting, getFirstName, getInitials } from "@/lib/format";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AdminContextProvider>
        <DashboardShell>{children}</DashboardShell>
      </AdminContextProvider>
    </AuthGuard>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  const { isAdminMode } = useAdminMode();

  return (
    <div className="bg-gradient-dashboard min-h-screen text-slate-800 dark:text-slate-200">
      <Sidebar />

      {/* ═══ Desktop Header ═══ */}
      <header
        className={cn(
          "hidden lg:flex fixed top-0 right-0 left-20 z-50 backdrop-blur-xl items-center justify-between px-8 shadow-sm h-20 bg-white dark:bg-[#161B22]",
          isAdminMode
            ? "border-b-2 border-amber-500/60"
            : "border-b border-slate-200/60 dark:border-white/5"
        )}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Control Finance
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <button className="relative p-2 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border border-white dark:border-slate-900" />
          </button>

          <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-700">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800 dark:text-white">
                {usuario ? `${getGreeting()}, ${getFirstName(usuario.nome)}` : "Olá"}
              </p>
              <p
                className={cn(
                  "text-xs font-semibold",
                  isAdminMode ? "text-amber-500" : "text-slate-500 dark:text-slate-400"
                )}
              >
                {isAdminMode ? "Administrador" : "Control Finance"}
              </p>
            </div>
            <div
              className={cn(
                "size-10 rounded-full overflow-hidden border-2 shadow-sm flex items-center justify-center text-sm font-bold",
                isAdminMode
                  ? "bg-amber-100 dark:bg-amber-500/20 border-amber-400 text-amber-700 dark:text-amber-300"
                  : "bg-slate-200 dark:bg-slate-700 border-white dark:border-slate-600 text-slate-600 dark:text-slate-300"
              )}
            >
              {usuario ? getInitials(usuario.nome) : "?"}
            </div>
          </div>
        </div>
      </header>

      {/* ═══ Main Content ═══ */}
      <main className="pt-16 lg:pt-24 pb-8 lg:pb-12 px-3 sm:px-6 lg:px-8 lg:ml-20">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
