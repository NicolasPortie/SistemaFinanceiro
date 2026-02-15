"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Shield } from "lucide-react";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { usuario, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!usuario || !isAdmin)) {
      router.replace("/dashboard");
    }
  }, [usuario, isAdmin, loading, router]);

  if (!usuario || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
