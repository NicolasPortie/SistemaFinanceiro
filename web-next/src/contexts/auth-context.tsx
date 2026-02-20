"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, AUTH_EXPIRED_EVENT, type Usuario, type RegistroPendenteResponse } from "@/lib/api";

interface AuthContextType {
  usuario: Usuario | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, senha: string) => Promise<void>;
  registrar: (nome: string, email: string, senha: string, codigoConvite: string) => Promise<RegistroPendenteResponse>;
  verificarRegistro: (email: string, codigo: string) => Promise<void>;
  logout: () => void;
  atualizarPerfil: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getStoredUsuario(): Usuario | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("cf_user");
  if (!stored) return null;
  try {
    return JSON.parse(stored) as Usuario;
  } catch {
    localStorage.removeItem("cf_user");
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUsuario(getStoredUsuario());
    setLoading(false);
  }, []);
  const isAdmin = usuario?.role === "Admin";
  const router = useRouter();

  // Listen for session expiry dispatched by the API layer
  useEffect(() => {
    const handleAuthExpired = () => {
      setUsuario(null);
      router.push("/login");
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, [router]);

  const login = useCallback(async (email: string, senha: string) => {
    const res = await api.auth.login({ email, senha });
    localStorage.setItem("cf_user", JSON.stringify(res.usuario));
    setUsuario(res.usuario);
  }, []);

  const registrar = useCallback(async (nome: string, email: string, senha: string, codigoConvite: string) => {
    return await api.auth.registrar({ nome, email, senha, codigoConvite });
  }, []);

  const verificarRegistro = useCallback(async (email: string, codigo: string) => {
    const res = await api.auth.verificarRegistro({ email, codigo });
    localStorage.setItem("cf_user", JSON.stringify(res.usuario));
    setUsuario(res.usuario);
  }, []);

  const logout = useCallback(() => {
    api.auth.logout().catch(() => { });
    localStorage.removeItem("cf_user");
    setUsuario(null);
  }, []);

  const atualizarPerfil = useCallback(async () => {
    try {
      const perfil = await api.auth.perfil();
      localStorage.setItem("cf_user", JSON.stringify(perfil));
      setUsuario(perfil);
    } catch {
      // ignore
    }
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, loading, isAdmin, login, registrar, verificarRegistro, logout, atualizarPerfil }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
