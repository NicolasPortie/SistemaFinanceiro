// ============================================================
// ControlFinance — Zod Schemas
// Type-safe validation schemas for all forms
// ============================================================

import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  senha: z.string().min(1, "Senha é obrigatória"),
});

export const registroSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").max(100, "Nome muito longo"),
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  senha: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Deve conter letra maiúscula")
    .regex(/[a-z]/, "Deve conter letra minúscula")
    .regex(/\d/, "Deve conter um número"),
  codigoConvite: z.string().min(1, "Código de convite é obrigatório"),
});

export const simulacaoSchema = z.object({
  descricao: z.string().min(1, "Descrição é obrigatória").max(200, "Descrição muito longa"),
  valor: z
    .string()
    .min(1, "Valor é obrigatório")
    .refine((v) => {
      const num = parseFloat(v.replace(",", "."));
      return !isNaN(num) && num > 0;
    }, "Valor deve ser maior que zero"),
  formaPagamento: z.enum(["pix", "debito", "credito"]),
  parcelas: z.number().min(1).max(12),
  cartaoId: z.string().optional(),
});

export const limiteSchema = z.object({
  categoria: z.string().min(1, "Selecione uma categoria"),
  valor: z
    .string()
    .min(1, "Valor é obrigatório")
    .refine((v) => {
      const num = parseFloat(v.replace(",", "."));
      return !isNaN(num) && num > 0;
    }, "Valor deve ser maior que zero"),
});

export const metaSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
  tipo: z.enum(["juntar_valor", "reduzir_gasto", "reserva_mensal"]),
  prioridade: z.enum(["baixa", "media", "alta"]),
  valorAlvo: z
    .string()
    .min(1, "Valor alvo é obrigatório")
    .refine((v) => {
      const num = parseFloat(v.replace(",", "."));
      return !isNaN(num) && num > 0;
    }, "Valor deve ser maior que zero"),
  valorAtual: z.string().optional(),
  prazo: z.string().min(1, "Prazo é obrigatório"),
  categoria: z.string().optional(),
});

export const cartaoSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(50, "Nome muito longo"),
  limite: z
    .string()
    .min(1, "Limite é obrigatório")
    .refine((v) => {
      const num = parseFloat(v.replace(",", "."));
      return !isNaN(num) && num > 0;
    }, "Valor deve ser maior que zero"),
  diaFechamento: z
    .string()
    .min(1, "Dia é obrigatório")
    .refine((v) => {
      const num = parseInt(v);
      return !isNaN(num) && num >= 1 && num <= 31;
    }, "Dia deve ser entre 1 e 31"),
  diaVencimento: z
    .string()
    .min(1, "Dia é obrigatório")
    .refine((v) => {
      const num = parseInt(v);
      return !isNaN(num) && num >= 1 && num <= 31;
    }, "Dia deve ser entre 1 e 31"),
});

export const lancamentoSchema = z.object({
  descricao: z.string().min(1, "Descrição é obrigatória"),
  valor: z
    .string()
    .min(1, "Valor é obrigatório")
    .refine((v) => {
      const num = parseFloat(v.replace(",", "."));
      return !isNaN(num) && num > 0;
    }, "Valor deve ser maior que zero"),
  tipo: z.enum(["despesa", "receita"]),
  categoria: z.string().optional(),
  cartaoId: z.string().optional(),
  formaPagamento: z.string().optional(),
  numeroParcelas: z.string().optional(),
  data: z.string().optional(),
});

export const editarLancamentoSchema = z.object({
  descricao: z.string().min(1, "Descrição é obrigatória"),
  valor: z
    .string()
    .min(1, "Valor é obrigatório")
    .refine((v) => {
      const num = parseFloat(v.replace(",", "."));
      return !isNaN(num) && num > 0;
    }, "Valor deve ser maior que zero"),
  categoria: z.string().optional(),
  data: z.string().optional(),
});

export const categoriaSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(50, "Nome muito longo"),
});

export const atualizarPerfilSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
});

export const alterarSenhaSchema = z
  .object({
    senhaAtual: z.string().min(1, "Senha atual é obrigatória"),
    novaSenha: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Deve conter letra maiúscula")
      .regex(/[a-z]/, "Deve conter letra minúscula")
      .regex(/\d/, "Deve conter um número"),
    confirmarSenha: z.string().min(1, "Confirmação é obrigatória"),
  })
  .refine((data) => data.novaSenha === data.confirmarSenha, {
    message: "As senhas não coincidem",
    path: ["confirmarSenha"],
  });

export const recuperarSenhaSchema = z.object({
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
});

export const redefinirSenhaSchema = z
  .object({
    email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
    codigo: z.string().min(6, "Código deve ter 6 dígitos").max(6, "Código deve ter 6 dígitos"),
    novaSenha: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Deve conter letra maiúscula")
      .regex(/[a-z]/, "Deve conter letra minúscula")
      .regex(/\d/, "Deve conter um número"),
    confirmarSenha: z.string().min(1, "Confirmação é obrigatória"),
  })
  .refine((data) => data.novaSenha === data.confirmarSenha, {
    message: "As senhas não coincidem",
    path: ["confirmarSenha"],
  });

export const verificarRegistroSchema = z.object({
  codigo: z.string().min(6, "Código deve ter 6 dígitos").max(6, "Código deve ter 6 dígitos"),
});

// ── Inferred Types ─────────────────────────────────────────
export type LoginData = z.infer<typeof loginSchema>;
export type RegistroData = z.infer<typeof registroSchema>;
export type VerificarRegistroData = z.infer<typeof verificarRegistroSchema>;
export type SimulacaoData = z.infer<typeof simulacaoSchema>;
export type LimiteData = z.infer<typeof limiteSchema>;
export type MetaData = z.infer<typeof metaSchema>;
export type CartaoData = z.infer<typeof cartaoSchema>;
export type LancamentoData = z.infer<typeof lancamentoSchema>;
export type EditarLancamentoData = z.infer<typeof editarLancamentoSchema>;
export type CategoriaData = z.infer<typeof categoriaSchema>;
export type AtualizarPerfilData = z.infer<typeof atualizarPerfilSchema>;
export type AlterarSenhaData = z.infer<typeof alterarSenhaSchema>;
export type RecuperarSenhaData = z.infer<typeof recuperarSenhaSchema>;
export type RedefinirSenhaData = z.infer<typeof redefinirSenhaSchema>;
