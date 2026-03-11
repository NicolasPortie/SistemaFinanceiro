"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  History,
  MessageSquare,
  Plus,
  Settings,
  Loader2,
  ArrowRight,
  Paperclip,
  Mic,
  Trash2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";
import type { MensagemDto } from "@/lib/api";
import {
  buildChatAttachmentOptimisticLabel,
  type ChatAttachmentKind,
  validateChatAttachment,
} from "@/lib/chat-attachment-utils";
import { cn } from "@/lib/utils";
import {
  ChatRichBlocks,
  isRichContent,
  parseRichContent,
} from "@/components/chat/chat-rich-blocks";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

type PendingAttachment = {
  file: File;
  kind: ChatAttachmentKind;
};

const SUGGESTIONS = [
  "Analisar minhas faturas deste mes",
  "Projecao de metas financeiras",
  "Otimizar meu Fluxo de Caixa",
  "Onde posso reduzir gastos?",
];

/* ─── Message bubble ─────────────────────────────────────── */
function MessageBubble({ msg }: { msg: MensagemDto }) {
  const isUser = msg.papel === "user";
  const rich = !isUser && isRichContent(msg.conteudo);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("flex flex-col", isUser ? "items-end" : "items-start gap-3")}
    >
      {isUser ? (
        <div className="max-w-[80%] text-slate-800 dark:text-slate-200 text-sm font-medium leading-relaxed px-4 py-2">
          <p className="whitespace-pre-wrap">{msg.conteudo}</p>
        </div>
      ) : (
        <>
          <div className="glass-bubble rounded-xl sm:rounded-[2rem] rounded-tl-none p-4 sm:p-7 max-w-[95%] sm:max-w-[92%] border-l-4 border-l-emerald-500 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {rich ? (
              <ChatRichBlocks content={parseRichContent(msg.conteudo)} />
            ) : (
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
                  strong: ({ children }) => (
                    <strong className="font-semibold text-slate-800 dark:text-white">
                      {children}
                    </strong>
                  ),
                  code: ({ children }) => (
                    <code className="font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-1 rounded text-xs">
                      {children}
                    </code>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-1 mb-3">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-1 mb-3">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-slate-600 dark:text-slate-300">{children}</li>
                  ),
                }}
              >
                {msg.conteudo}
              </ReactMarkdown>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}

/* ─── Sidebar item ───────────────────────────────────────── */
function SidebarItem({
  id,
  titulo,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: {
  id: number;
  titulo: string;
  isActive: boolean;
  onSelect: () => void;
  onRename: (t: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(titulo);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSelectKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (editing) return;
    if (event.currentTarget !== event.target) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  const handleRename = () => {
    if (draft.trim() && draft !== titulo) onRename(draft.trim());
    setEditing(false);
  };

  return (
    <div
      data-chat-id={id}
      onClick={() => !editing && onSelect()}
      onKeyDown={handleSelectKeyDown}
      role="button"
      tabIndex={editing ? -1 : 0}
      aria-current={isActive ? "page" : undefined}
      aria-label={`Abrir conversa ${titulo}`}
      className={cn(
        "group flex items-center gap-4 rounded-xl p-2 pr-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60",
        isActive
          ? "bg-white shadow-sm dark:bg-slate-800"
          : "cursor-pointer hover:bg-white dark:hover:bg-slate-800"
      )}
    >
      <MessageSquare
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive ? "text-emerald-500" : "text-slate-300 group-hover:text-emerald-500"
        )}
      />

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRename();
            if (e.key === "Escape") setEditing(false);
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Renomear conversa ${titulo}`}
          className="label-text flex-1 text-[11px] bg-transparent border-none outline-none text-slate-700 dark:text-slate-200 min-w-0 w-0"
        />
      ) : (
        <span
          className={cn(
            "label-text flex-1 w-0 truncate text-[11px]",
            isActive
              ? "text-slate-900 dark:text-white"
              : "text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white"
          )}
        >
          {titulo}
        </span>
      )}

      <div
        className="label-text flex shrink-0 items-center gap-1 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        {editing ? (
          <>
            <button
              type="button"
              onClick={handleRename}
              aria-label={`Salvar novo nome da conversa ${titulo}`}
              className="p-0.5 text-emerald-500 hover:text-emerald-700 cursor-pointer"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              aria-label={`Cancelar edicao da conversa ${titulo}`}
              className="p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Renomear conversa ${titulo}`}
              className="p-0.5 text-slate-300 hover:text-slate-600 cursor-pointer"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Excluir conversa ${titulo}`}
              className="p-0.5 text-slate-300 hover:text-rose-500 cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────── */
export default function ChatPage() {
  const { usuario } = useAuth();
  const queryClient = useQueryClient();
  const tempIdRef = useRef(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeConversaId, setActiveConversaId] = useState<number | null>(null);
  const [messages, setMessages] = useState<MensagemDto[]>([]);
  const [inputText, setInputText] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isMobileMemoryOpen, setIsMobileMemoryOpen] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const { data: conversas = [] } = useQuery({
    queryKey: ["chat-conversas"],
    queryFn: () => api.chat.listarConversas(),
    staleTime: 30_000,
  });

  const { data: conversaData, isFetching: isLoadingConversa } = useQuery({
    queryKey: ["chat-conversa", activeConversaId],
    queryFn: () => api.chat.obterConversa(activeConversaId!),
    enabled: !!activeConversaId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (conversaData?.mensagens) setMessages(conversaData.mensagens);
  }, [conversaData]);

  const handleNewConversation = () => {
    setActiveConversaId(null);
    setMessages([]);
    setPendingAttachment(null);
    setInputText("");
    setIsMobileMemoryOpen(false);
  };

  const handleSelectConversation = (conversaId: number) => {
    setActiveConversaId(conversaId);
    setMessages([]);
    setPendingAttachment(null);
    setInputText("");
    setIsMobileMemoryOpen(false);
  };

  const addOptimistic = useCallback((conteudo: string, origem: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: tempIdRef.current--,
        conteudo,
        papel: "user",
        origem,
        criadoEm: new Date().toISOString(),
      },
    ]);
  }, []);

  const replaceOptimistic = useCallback(
    (res: { mensagemUsuario: MensagemDto; mensagemAssistente: MensagemDto }) => {
      setMessages((prev) => [
        ...prev.filter((m) => m.id > 0),
        res.mensagemUsuario,
        res.mensagemAssistente,
      ]);
    },
    []
  );

  const removeOptimistic = useCallback(() => {
    setMessages((prev) => prev.filter((m) => m.id > 0));
  }, []);

  const sendText = useMutation({
    mutationFn: (text: string) =>
      api.chat.enviarMensagem({ mensagem: text, conversaId: activeConversaId ?? undefined }),
    onMutate: (text) => addOptimistic(text, "Texto"),
    onSuccess: (res) => {
      replaceOptimistic(res);
      if (!activeConversaId || activeConversaId !== res.conversaId)
        setActiveConversaId(res.conversaId);
      queryClient.invalidateQueries({ queryKey: ["chat-conversas"] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversa", res.conversaId] });
    },
    onError: (error) => {
      removeOptimistic();
      toast.error(extractErrorMessage(error, "Nao foi possivel enviar sua mensagem."));
    },
  });

  const sendAudio = useMutation({
    mutationFn: (file: File) => api.chat.enviarAudio(file, activeConversaId ?? undefined),
    onMutate: () => addOptimistic("Áudio enviado...", "Audio"),
    onSuccess: (res) => {
      replaceOptimistic(res);
      if (!activeConversaId || activeConversaId !== res.conversaId)
        setActiveConversaId(res.conversaId);
      queryClient.invalidateQueries({ queryKey: ["chat-conversas"] });
    },
    onError: (error) => {
      removeOptimistic();
      toast.error(extractErrorMessage(error, "Nao foi possivel processar o audio."));
    },
  });

  const sendAttachment = useMutation({
    mutationFn: ({
      file,
      kind,
      caption,
    }: {
      file: File;
      kind: PendingAttachment["kind"];
      caption?: string;
    }) =>
      kind === "image"
        ? api.chat.enviarImagem(file, activeConversaId ?? undefined, caption)
        : api.chat.enviarDocumento(file, activeConversaId ?? undefined, caption),
    onMutate: ({ file, kind, caption }) =>
      addOptimistic(
        buildChatAttachmentOptimisticLabel(file, kind, caption),
        kind === "image" ? "Imagem" : "Documento"
      ),
    onSuccess: (res) => {
      replaceOptimistic(res);
      setPendingAttachment(null);
      setInputText("");
      if (!activeConversaId || activeConversaId !== res.conversaId)
        setActiveConversaId(res.conversaId);
      queryClient.invalidateQueries({ queryKey: ["chat-conversas"] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversa", res.conversaId] });
    },
    onError: (error) => {
      removeOptimistic();
      toast.error(extractErrorMessage(error, "Nao foi possivel processar o arquivo."));
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, titulo }: { id: number; titulo: string }) =>
      api.chat.renomearConversa(id, titulo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chat-conversas"] }),
    onError: (error) => toast.error(extractErrorMessage(error, "Nao foi possivel renomear.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.chat.excluirConversa(id),
    onSuccess: (_, deletedId) => {
      if (activeConversaId === deletedId) {
        setActiveConversaId(null);
        setMessages([]);
        setInputText("");
        setPendingAttachment(null);
      }
      queryClient.invalidateQueries({ queryKey: ["chat-conversas"] });
    },
    onError: (error) => toast.error(extractErrorMessage(error, "Nao foi possivel excluir.")),
  });

  const isSending = sendText.isPending || sendAudio.isPending || sendAttachment.isPending;
  const hasMessages = messages.length > 0;
  const canSubmit = Boolean(inputText.trim()) || Boolean(pendingAttachment);
  const activeConversationTitle =
    conversas.find((conversa) => conversa.id === activeConversaId)?.titulo ??
    (hasMessages ? "Conversa atual" : "Nova conversa");
  const isConversationLoadingState = Boolean(activeConversaId) && isLoadingConversa && !hasMessages;

  const handleSend = () => {
    const text = inputText.trim();
    if (isSending) return;

    if (pendingAttachment) {
      sendAttachment.mutate({
        file: pendingAttachment.file,
        kind: pendingAttachment.kind,
        caption: text || undefined,
      });
      return;
    }

    if (!text) return;
    setInputText("");
    sendText.mutate(text);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorder.current?.stop();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream);
        audioChunks.current = [];
        mr.ondataavailable = (e) => audioChunks.current.push(e.data);
        mr.onstop = () => {
          const blob = new Blob(audioChunks.current, { type: "audio/webm" });
          sendAudio.mutate(new File([blob], "audio.webm", { type: "audio/webm" }));
          stream.getTracks().forEach((t) => t.stop());
          setIsRecording(false);
        };
        mr.start();
        mediaRecorder.current = mr;
        setIsRecording(true);
      } catch {
        toast.error("Nao foi possivel acessar o microfone.");
      }
    }
  };

  const handleAttachmentSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || isSending) return;

    const validation = validateChatAttachment(file);
    if (!validation.kind) {
      toast.error(validation.error ?? "Arquivo nao suportado.");
      return;
    }

    setPendingAttachment({ file, kind: validation.kind });
  };

  return (
    <div className="ivory-bg h-full flex overflow-hidden">
      <Dialog open={isMobileMemoryOpen} onOpenChange={setIsMobileMemoryOpen}>
        <DialogContent className="sm:hidden max-w-[calc(100%-1rem)] gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-slate-200/70 px-5 py-4 pr-14 dark:border-white/10">
            <DialogTitle className="text-base text-slate-900 dark:text-white">
              Conversas
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
              Retome uma conversa, crie uma nova sessao ou ajuste o assistente.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
            <button
              type="button"
              onClick={handleNewConversation}
              className="flex w-full items-center gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/40"
            >
              <Plus className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  Nova conversa
                </p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
                  Limpa o rascunho atual e inicia um novo contexto.
                </p>
              </div>
            </button>

            <div className="mt-4 space-y-1">
              {conversas.map((conversa) => (
                <SidebarItem
                  key={conversa.id}
                  id={conversa.id}
                  titulo={conversa.titulo}
                  isActive={activeConversaId === conversa.id}
                  onSelect={() => handleSelectConversation(conversa.id)}
                  onRename={(titulo) => renameMutation.mutate({ id: conversa.id, titulo })}
                  onDelete={() => deleteMutation.mutate(conversa.id)}
                />
              ))}

              {conversas.length === 0 && (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  Nenhuma conversa salva ainda.
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200/70 px-4 py-4 dark:border-white/10">
            <Link
              href="/configuracoes"
              onClick={() => setIsMobileMemoryOpen(false)}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <Settings className="h-4 w-4" />
              Configuracoes do assistente
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Memory Sidebar ═══ */}
      <aside className="sidebar-memory flex h-full shrink-0 flex-col overflow-hidden border-r border-[rgba(15,23,42,0.06)] bg-white/60 py-6 dark:border-white/5 dark:bg-slate-900/60">
        <div className="flex items-center px-4 mb-6 gap-4">
          <History className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="label-text text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
            Memória
          </span>
        </div>

        <div className="px-3 mb-4">
          <button
            type="button"
            onClick={handleNewConversation}
            className="group flex items-center gap-4 p-2 rounded-xl w-full hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4 shrink-0 text-emerald-500" />
            <span className="label-text text-[11px] font-bold text-emerald-600 whitespace-nowrap">
              Nova conversa
            </span>
          </button>
        </div>

        <div className="flex-1 space-y-1 px-3 overflow-y-auto hide-scrollbar">
          {conversas.map((c) => (
            <SidebarItem
              key={c.id}
              id={c.id}
              titulo={c.titulo}
              isActive={activeConversaId === c.id}
              onSelect={() => handleSelectConversation(c.id)}
              onRename={(titulo) => renameMutation.mutate({ id: c.id, titulo })}
              onDelete={() => deleteMutation.mutate(c.id)}
            />
          ))}
          {conversas.length === 0 && (
            <p className="label-text text-[10px] text-slate-400 text-center py-8 px-2">
              Nenhuma conversa ainda
            </p>
          )}
        </div>

        <div className="px-4 mt-4">
          <Link href="/configuracoes" aria-label="Abrir configuracoes do assistente">
            <Settings className="h-4 w-4 text-slate-300 hover:text-slate-600 dark:hover:text-slate-400 cursor-pointer transition-colors" />
          </Link>
        </div>
      </aside>

      {/* ═══ Chat Area ═══ */}
      <div className="flex-1 flex flex-col h-full relative min-w-0">
        <div className="flex items-center gap-2 border-b border-[rgba(15,23,42,0.06)] bg-white/80 px-4 py-3 dark:border-white/5 dark:bg-slate-900/70 sm:hidden">
          <button
            type="button"
            onClick={() => setIsMobileMemoryOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
            aria-label="Abrir conversas anteriores"
          >
            <History className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Ravier
            </p>
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">
              {activeConversationTitle}
            </p>
          </div>

          <button
            type="button"
            onClick={handleNewConversation}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 transition-colors hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-400"
            aria-label="Iniciar nova conversa"
          >
            <Plus className="h-4 w-4" />
          </button>

          <Link
            href="/configuracoes"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
            aria-label="Abrir configuracoes do assistente"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>

        {isConversationLoadingState && (
          <div className="flex flex-1 items-center justify-center px-6 pb-48">
            <div className="glass-bubble flex items-center gap-3 rounded-[1.75rem] rounded-tl-none border-l-4 border-l-emerald-500 px-6 py-5 text-sm text-slate-500 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
              Carregando conversa...
            </div>
          </div>
        )}

        {/* Welcome / empty state */}
        {!hasMessages && !isConversationLoadingState && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-48">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center max-w-md"
            >
              <div className="w-16 h-16 rounded-[1.5rem] bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-center mx-auto mb-6 shadow-[0_12px_32px_rgba(15,23,42,0.10)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.24)]">
                <Image
                  src="/logoSemTexto.png"
                  alt="Ravier"
                  width={34}
                  height={34}
                  className="object-contain"
                  priority
                />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight mb-1 serif-italic">
                Ravier
              </h2>
              <p className="text-[11px] text-slate-400 uppercase tracking-[0.2em] font-medium">
                Consultor Financeiro Executivo
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-5 leading-relaxed">
                Ola{usuario?.nome ? `, ${usuario.nome.split(" ")[0]}` : ""}! Estou pronto para
                analisar suas financas, projetar metas e identificar oportunidades de otimizacao.
              </p>
            </motion.div>
          </div>
        )}

        {/* Messages */}
        {hasMessages && (
          <div className="flex-1 overflow-y-auto hide-scrollbar px-6 pt-10">
            <div className="max-w-3xl mx-auto space-y-10 pb-52">
              <div className="flex items-center gap-4 opacity-40">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-slate-400">
                  Sessao iniciada - hoje
                </span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              </div>

              {messages.map((msg, idx) => (
                <MessageBubble key={msg.id || idx} msg={msg} />
              ))}

              {isSending && (
                <div className="flex items-start">
                  <div className="glass-bubble rounded-[2rem] rounded-tl-none px-7 py-5 border-l-4 border-l-emerald-500 flex items-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                    <span className="text-sm text-slate-500">Ravier esta analisando...</span>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>
        )}

        {/* ═══ Input Area ═══ */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-linear-to-t from-[#F9F9F7] via-[#F9F9F7]/95 to-transparent px-6 pb-6 pt-20 dark:from-[#0a0e14] dark:via-[#0a0e14]/95">
          <div className="max-w-3xl mx-auto flex flex-col items-center gap-4 pointer-events-auto">
            {/* Suggestions (empty state only) */}
            {!hasMessages && (
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => {
                      setInputText(s);
                      inputRef.current?.focus();
                    }}
                    className="px-4 py-2 rounded-full bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest hover:border-emerald-500 hover:text-emerald-600 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {pendingAttachment && (
              <div className="w-full rounded-[1.5rem] border border-emerald-200/70 bg-white/85 px-4 py-3 shadow-[0_12px_32px_-18px_rgba(16,185,129,0.45)] dark:border-emerald-900/60 dark:bg-slate-900/85">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
                      {pendingAttachment.kind === "image" ? "Imagem pronta" : "Documento pronto"}
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                      {pendingAttachment.file.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      {pendingAttachment.kind === "image"
                        ? "Adicione uma legenda opcional antes de enviar."
                        : "Explique o que deseja extrair ou analisar."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingAttachment(null)}
                    disabled={isSending}
                    aria-label="Remover arquivo anexado"
                    className="cursor-pointer rounded-full border border-slate-200 p-2 text-slate-400 transition-colors hover:border-rose-200 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Pill input */}
            <div className="w-full bg-white dark:bg-slate-900 rounded-full px-5 py-3 flex items-center gap-2 border border-[rgba(15,23,42,0.08)] dark:border-slate-700 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.06)]">
              <input
                ref={fileInputRef}
                id="chat-attachment-input"
                name="chat_attachment"
                type="file"
                accept="image/*,.pdf,.txt,.csv,.json,.xml,.md"
                className="hidden"
                onChange={handleAttachmentSelected}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending}
                aria-label="Adicionar imagem ou documento"
                className="cursor-pointer p-2 shrink-0 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={toggleRecording}
                disabled={isSending}
                aria-label={isRecording ? "Parar gravacao de audio" : "Gravar audio"}
                className={cn(
                  "cursor-pointer p-2 shrink-0 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  isRecording
                    ? "text-rose-500 animate-pulse"
                    : "text-slate-400 hover:text-emerald-500"
                )}
              >
                <Mic className="h-4 w-4" />
              </button>
              <input
                ref={inputRef}
                id="chat-message-input"
                name="chat_message"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={isSending || isLoadingConversa}
                aria-label={
                  pendingAttachment
                    ? "Legenda opcional para o anexo"
                    : "Mensagem para o assistente financeiro"
                }
                placeholder={
                  pendingAttachment
                    ? "Adicione uma legenda opcional ou envie direto..."
                    : "Escreva sua solicitacao para o Ravier..."
                }
                className="flex-1 bg-transparent border-none outline-none ring-0 focus:ring-0 text-sm placeholder:text-slate-300 dark:placeholder:text-slate-600 text-slate-700 dark:text-slate-200 ml-1 min-w-0"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSubmit || isSending}
                aria-label={pendingAttachment ? "Enviar anexo" : "Enviar mensagem"}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.25)] transition-all hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </button>
            </div>

            <p className="text-[9px] text-slate-400 dark:text-slate-600 tracking-widest uppercase font-medium pb-1">
              Processamento Seguro via Executive Hub
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
