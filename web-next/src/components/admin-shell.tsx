"use client";

import { useEffect } from "react";
import { useAdminMode } from "@/contexts/admin-context";

export function AdminModeProvider({ children }: { children: React.ReactNode }) {
  const { setAdminMode } = useAdminMode();

  useEffect(() => {
    setAdminMode(true);
    return () => setAdminMode(false);
  }, [setAdminMode]);

  return <>{children}</>;
}
