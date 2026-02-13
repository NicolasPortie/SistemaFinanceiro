import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Faça login na sua conta ControlFinance",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
