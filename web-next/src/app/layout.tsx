import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ControlFinance — Controle Financeiro Inteligente",
    template: "%s | ControlFinance",
  },
  description:
    "Gerencie suas finanças pessoais de forma inteligente com IA. Dashboard, simulações, metas e integração com Telegram.",
  keywords: ["controle financeiro", "finanças pessoais", "orçamento", "metas financeiras"],
  authors: [{ name: "ControlFinance" }],
  openGraph: {
    title: "ControlFinance — Controle Financeiro Inteligente",
    description: "Gerencie suas finanças pessoais de forma inteligente com IA.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
