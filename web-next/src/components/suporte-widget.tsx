"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, Mail, ArrowLeft, Headphones, History, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";
import type { SuporteMensagemHistorico } from "@/lib/api";
import { cn } from "@/lib/utils";
import { getFirstName } from "@/lib/format";

interface Message {
  id: number;
  papel: "user" | "assistant";
  conteudo: string;
  criadoEm: string;
}

interface SupportSession {
  id: string;
  titulo: string;
  updatedAt: string;
  messages: Message[];
}

type ViewState = "chat" | "email" | "history";

const STORAGE_PREFIX = "ravier-suporte-sessoes";

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildSessionTitle(messages: Message[]) {
  const firstUserMessage = messages.find((message) => message.papel === "user");
  if (!firstUserMessage) return "Novo atendimento";

  return firstUserMessage.conteudo.length > 42
    ? `${firstUserMessage.conteudo.slice(0, 42).trim()}...`
    : firstUserMessage.conteudo;
}

export function SuporteWidget() {
  const { usuario } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<ViewState>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [emailAssunto, setEmailAssunto] = useState("");
  const [emailDescricao, setEmailDescricao] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idCounter = useRef(0);
  const storageKey = useMemo(() => {
    if (!usuario) return null;
    return `${STORAGE_PREFIX}:${usuario.email.toLowerCase()}`;
  }, [usuario]);

  const createWelcomeMessage = useCallback((): Message => {
    const nome = usuario ? getFirstName(usuario.nome) : "";
    return {
      id: idCounter.current++,
      papel: "assistant",
      conteudo: `Olá${nome ? `, ${nome}` : ""}! Sou o **Ravi**, suporte da Ravier. Posso continuar um atendimento anterior ou abrir um novo agora mesmo.`,
      criadoEm: new Date().toISOString(),
    };
  }, [usuario]);

  const activateSession = useCallback((session: SupportSession) => {
    setActiveSessionId(session.id);
    setMessages(session.messages);
    setView("chat");
  }, []);

  const syncSessionMessages = useCallback((sessionId: string | null, nextMessages: Message[]) => {
    if (!sessionId) return;

    setSessions((prev) => {
      const existing = prev.find((session) => session.id === sessionId);
      const updatedSession: SupportSession = {
        id: sessionId,
        titulo: buildSessionTitle(nextMessages),
        updatedAt: new Date().toISOString(),
        messages: nextMessages,
      };

      if (!existing) {
        return [updatedSession, ...prev].slice(0, 12);
      }

      return [updatedSession, ...prev.filter((session) => session.id !== sessionId)].slice(0, 12);
    });
  }, []);

  const createNewSession = useCallback(() => {
    const welcome = createWelcomeMessage();
    const sessionId = createSessionId();
    const nextMessages = [welcome];

    setActiveSessionId(sessionId);
    setMessages(nextMessages);
    setSessions((prev) =>
      [
        {
          id: sessionId,
          titulo: "Novo atendimento",
          updatedAt: new Date().toISOString(),
          messages: nextMessages,
        },
        ...prev,
      ].slice(0, 12)
    );
    setView("chat");
  }, [createWelcomeMessage]);

  useEffect(() => {
    if (!storageKey) return;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setSessions([]);
        setMessages([]);
        setActiveSessionId(null);
        return;
      }

      const parsed = JSON.parse(raw) as SupportSession[];
      const ordered = parsed
        .filter((session) => Array.isArray(session.messages) && session.messages.length > 0)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      setSessions(ordered);
      if (ordered.length > 0) {
        setActiveSessionId(ordered[0].id);
        setMessages(ordered[0].messages);
      } else {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch {
      setSessions([]);
      setMessages([]);
      setActiveSessionId(null);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    window.localStorage.setItem(storageKey, JSON.stringify(sessions));
  }, [sessions, storageKey]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when widget opens
  useEffect(() => {
    if (isOpen && view === "chat") {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, view]);

  // Add welcome message on first open
  const handleOpen = useCallback(() => {
    setIsOpen(true);
    if (sessions.length > 0) {
      if (!activeSessionId) activateSession(sessions[0]);
      return;
    }

    if (messages.length === 0) {
      createNewSession();
    }
  }, [activateSession, activeSessionId, createNewSession, messages.length, sessions]);

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: (text: string) => {
      const historico: SuporteMensagemHistorico[] = messages.map((m) => ({
        papel: m.papel,
        conteudo: m.conteudo,
      }));
      return api.suporte.enviarMensagem({
        mensagem: text,
        historico,
        paginaAtual: pathname,
      });
    },
    onMutate: (text) => {
      setMessages((prev) => {
        const nextMessages: Message[] = [
          ...prev,
          {
            id: idCounter.current++,
            papel: "user",
            conteudo: text,
            criadoEm: new Date().toISOString(),
          },
        ];
        syncSessionMessages(activeSessionId, nextMessages);
        return nextMessages;
      });
    },
    onSuccess: (res) => {
      setMessages((prev) => {
        const nextMessages: Message[] = [
          ...prev,
          {
            id: idCounter.current++,
            papel: "assistant",
            conteudo: res.resposta,
            criadoEm: new Date().toISOString(),
          },
        ];
        syncSessionMessages(activeSessionId, nextMessages);
        return nextMessages;
      });
    },
    onError: () => {
      setMessages((prev) => {
        const nextMessages: Message[] = [
          ...prev,
          {
            id: idCounter.current++,
            papel: "assistant",
            conteudo: "Desculpe, não consegui processar sua mensagem. Tente novamente.",
            criadoEm: new Date().toISOString(),
          },
        ];
        syncSessionMessages(activeSessionId, nextMessages);
        return nextMessages;
      });
    },
  });

  // Send email mutation
  const sendEmail = useMutation({
    mutationFn: () =>
      api.suporte.enviarEmail({
        assunto: emailAssunto,
        descricao: emailDescricao,
      }),
    onSuccess: () => {
      toast.success("Email enviado para suporte@ravier.com.br!");
      setEmailAssunto("");
      setEmailDescricao("");
      setView("chat");
      setMessages((prev) => {
        const nextMessages: Message[] = [
          ...prev,
          {
            id: idCounter.current++,
            papel: "assistant",
            conteudo:
              "Email enviado com sucesso! Nossa equipe vai analisar e responder o mais rápido possível.",
            criadoEm: new Date().toISOString(),
          },
        ];
        syncSessionMessages(activeSessionId, nextMessages);
        return nextMessages;
      });
    },
    onError: () => {
      toast.error("Falha ao enviar email. Tente novamente.");
    },
  });

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || sendMessage.isPending) return;
    setInputText("");
    sendMessage.mutate(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!usuario) return null;

  return (
    <>
      {/* ── Floating Action Button ── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            onClick={handleOpen}
            className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 transition-all duration-200 hover:bg-emerald-700 hover:shadow-xl hover:shadow-emerald-600/40 cursor-pointer active:scale-95 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14 sm:shadow-emerald-600/30"
            aria-label="Abrir suporte"
          >
            <Headphones className="h-5 w-5 sm:h-6 sm:w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Chat Panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-50 flex h-[78vh] max-h-[42rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700/50 dark:bg-[#161B22] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-130 sm:w-95 sm:max-h-[80vh]"
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 py-3 bg-emerald-600 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                {view === "email" || view === "history" ? (
                  <button
                    onClick={() => setView("chat")}
                    aria-label="Voltar para o chat de suporte"
                    className="p-0.5 hover:bg-white/20 rounded-md transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Headphones className="h-4 w-4" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold leading-tight">
                    {view === "email"
                      ? "Enviar Email"
                      : view === "history"
                        ? "Atendimentos"
                        : "Ravi"}
                  </p>
                  {view === "chat" && (
                    <p className="text-[10px] text-emerald-100 leading-tight">Suporte da Ravier</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {view === "chat" && (
                  <button
                    onClick={() => setView("history")}
                    aria-label="Ver atendimentos anteriores"
                    className="p-1.5 hover:bg-white/20 rounded-md transition-colors cursor-pointer"
                    title="Ver atendimentos anteriores"
                  >
                    <History className="h-4 w-4" />
                  </button>
                )}
                {view === "chat" && (
                  <button
                    onClick={createNewSession}
                    aria-label="Iniciar novo atendimento"
                    className="p-1.5 hover:bg-white/20 rounded-md transition-colors cursor-pointer"
                    title="Novo atendimento"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
                {view === "chat" && (
                  <button
                    onClick={() => setView("email")}
                    aria-label="Abrir formulário de email para suporte"
                    className="p-1.5 hover:bg-white/20 rounded-md transition-colors cursor-pointer"
                    title="Enviar email para suporte"
                  >
                    <Mail className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Fechar suporte"
                  className="p-1.5 hover:bg-white/20 rounded-md transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {view === "chat" ? (
              <>
                {sessions.length > 1 && (
                  <div className="shrink-0 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 text-[11px] text-slate-500 dark:border-slate-700/50 dark:bg-slate-900/40 dark:text-slate-400">
                    Continuando:{" "}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {sessions.find((session) => session.id === activeSessionId)?.titulo ??
                        "Atendimento atual"}
                    </span>
                  </div>
                )}
                {/* ── Messages ── */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 hide-scrollbar">
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn("flex", msg.papel === "user" ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                          msg.papel === "user"
                            ? "bg-emerald-600 text-white rounded-br-md"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-bl-md"
                        )}
                      >
                        {msg.papel === "assistant" ? (
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                              strong: ({ children }) => (
                                <strong className="font-semibold">{children}</strong>
                              ),
                              ul: ({ children }) => (
                                <ul className="list-disc list-inside space-y-0.5 mb-1.5">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="list-decimal list-inside space-y-0.5 mb-1.5">
                                  {children}
                                </ol>
                              ),
                              a: ({ href, children }) => (
                                <a
                                  href={href}
                                  className="text-emerald-600 dark:text-emerald-400 underline"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {children}
                                </a>
                              ),
                            }}
                          >
                            {msg.conteudo}
                          </ReactMarkdown>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.conteudo}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {sendMessage.isPending && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div ref={bottomRef} />
                </div>

                {/* ── Input ── */}
                <div className="shrink-0 p-3 border-t border-slate-100 dark:border-slate-700/50">
                  <div className="flex items-center gap-2">
                    <input
                      id="support-chat-input"
                      name="support_chat_input"
                      aria-label="Digite sua mensagem para o suporte"
                      ref={inputRef}
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Digite sua dúvida..."
                      disabled={sendMessage.isPending}
                      maxLength={2000}
                      className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-600 bg-transparent px-3.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all disabled:opacity-50"
                    />
                    <button
                      onClick={handleSend}
                      aria-label="Enviar mensagem para o suporte"
                      disabled={!inputText.trim() || sendMessage.isPending}
                      className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95 shrink-0"
                    >
                      {sendMessage.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : view === "history" ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-3 hide-scrollbar bg-slate-50/40 dark:bg-slate-900/20">
                <button
                  onClick={createNewSession}
                  aria-label="Criar um novo atendimento"
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-white px-4 py-3 text-sm font-medium text-emerald-700 transition-colors hover:border-emerald-500 hover:text-emerald-800 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-emerald-300"
                >
                  <Plus className="h-4 w-4" />
                  Novo atendimento
                </button>

                {sessions.length > 0 ? (
                  sessions.map((session) => {
                    const lastMessage = session.messages[session.messages.length - 1];
                    const isActive = session.id === activeSessionId;
                    return (
                      <button
                        key={session.id}
                        onClick={() => activateSession(session)}
                        aria-label={`Abrir atendimento ${session.titulo}`}
                        className={cn(
                          "w-full rounded-2xl border px-4 py-3 text-left transition-all",
                          isActive
                            ? "border-emerald-500 bg-emerald-50 shadow-sm dark:bg-emerald-950/20"
                            : "border-slate-200 bg-white hover:border-emerald-300 dark:border-slate-700 dark:bg-[#161B22]"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                            {session.titulo}
                          </p>
                          <span className="text-[10px] uppercase tracking-wider text-slate-400">
                            {new Date(session.updatedAt).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                          {lastMessage?.conteudo ?? "Sem mensagens ainda."}
                        </p>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-[#161B22] dark:text-slate-400">
                    Nenhum atendimento anterior salvo neste navegador.
                  </div>
                )}
              </div>
            ) : (
              /* ── Email Form ── */
              <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Envie um email diretamente para nossa equipe de suporte. Responderemos o mais
                  rápido possível.
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Assunto
                  </label>
                  <input
                    id="support-email-subject"
                    name="support_email_subject"
                    aria-label="Assunto do email de suporte"
                    type="text"
                    value={emailAssunto}
                    onChange={(e) => setEmailAssunto(e.target.value)}
                    placeholder="Ex: Problema com cobrança"
                    maxLength={200}
                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-600 bg-transparent px-3.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div className="space-y-1.5 flex-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Descrição
                  </label>
                  <textarea
                    id="support-email-description"
                    name="support_email_description"
                    aria-label="Descrição do email de suporte"
                    value={emailDescricao}
                    onChange={(e) => setEmailDescricao(e.target.value)}
                    placeholder="Descreva seu problema ou dúvida em detalhes..."
                    maxLength={5000}
                    className="w-full h-full min-h-40 rounded-xl border border-slate-200 dark:border-slate-600 bg-transparent px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all resize-none"
                  />
                </div>
                <button
                  onClick={() => sendEmail.mutate()}
                  aria-label="Enviar email para a equipe de suporte"
                  disabled={!emailAssunto.trim() || !emailDescricao.trim() || sendEmail.isPending}
                  className="w-full h-10 rounded-xl bg-emerald-600 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                >
                  {sendEmail.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Enviar Email
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
