"use client";

import { createContext, useContext, useState } from "react";

interface AdminContextValue {
  isAdminMode: boolean;
  setAdminMode: (v: boolean) => void;
}

const AdminContext = createContext<AdminContextValue>({
  isAdminMode: false,
  setAdminMode: () => {},
});

export function AdminContextProvider({ children }: { children: React.ReactNode }) {
  const [isAdminMode, setAdminMode] = useState(false);
  return (
    <AdminContext.Provider value={{ isAdminMode, setAdminMode }}>{children}</AdminContext.Provider>
  );
}

export function useAdminMode() {
  return useContext(AdminContext);
}
