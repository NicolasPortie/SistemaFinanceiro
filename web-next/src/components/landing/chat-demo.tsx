"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, Mic, Camera, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

type MessageNode = {
    id: string;
    sender: "user" | "bot";
    type: "text" | "audio" | "image";
    content?: React.ReactNode;
    delayMs?: number;
    typingMs?: number;
    uniqueId?: string;
};

const SCENARIOS: MessageNode[][] = [
    [
        // OCR Scenario
        {
            id: "ocr-1",
            sender: "user",
            type: "image",
            delayMs: 1000,
        },
        {
            id: "ocr-2",
            sender: "bot",
            type: "text",
            delayMs: 1500,
            typingMs: 1000,
            content: (
                <>
                    <div className="flex items-center gap-2 mb-3 text-emerald-600">
                        <Sparkles className="size-4" />
                        <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">Visão IA Ativada</span>
                    </div>
                    <p className="text-[15px] leading-relaxed mb-4 text-stone-700">
                        Nota processada! 🛒 Identifiquei 32 itens. Lancei <strong className="text-stone-900 font-semibold">R$ 230,00</strong> em Mercado e <strong className="text-stone-900 font-semibold">R$ 45,00</strong> em Higiene Pessoal.
                    </p>
                    <div className="bg-stone-50 rounded-xl p-3 text-sm border border-stone-200 flex items-center justify-between">
                        <span className="text-stone-600 text-xs font-semibold">Orçamento Alimentação</span>
                        <span className="text-emerald-700 font-bold text-xs bg-emerald-100 px-2 py-1 rounded">OK</span>
                    </div>
                </>
            ),
        }
    ],
    [
        // Audio Scenario
        {
            id: "audio-1",
            sender: "user",
            type: "audio",
            delayMs: 1000,
        },
        {
            id: "audio-2",
            sender: "bot",
            type: "text",
            delayMs: 1500,
            typingMs: 1200,
            content: (
                <>
                    <div className="flex items-center gap-2 mb-3 text-emerald-600">
                        <Mic className="size-4" />
                        <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">Áudio Transcrito</span>
                    </div>
                    <p className="text-[15px] leading-relaxed mb-4 text-stone-700">
                        Pronto! Registrei <strong className="text-stone-900 font-semibold">R$ 150,00</strong> na categoria <strong className="text-stone-900 font-semibold">Combustível</strong>.
                    </p>
                    <div className="bg-stone-50 rounded-xl p-4 text-sm border border-stone-200">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-stone-500 text-xs font-semibold uppercase tracking-wider">Transporte no mês</span>
                            <span className="font-bold text-amber-600 text-base">80% Comprom.</span>
                        </div>
                        <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden mt-1">
                            <div className="bg-amber-500 h-full w-[80%] rounded-full shadow-[0_0_10px_rgba(245,158,11,0.3)]" />
                        </div>
                    </div>
                </>
            ),
        }
    ],
    [
        // Text Scenario & Multi-card
        {
            id: "text-1",
            sender: "user",
            type: "text",
            delayMs: 1000,
            content: "Ifood de 89,90 no crédito em 3x",
        },
        {
            id: "text-2",
            sender: "bot",
            type: "text",
            delayMs: 800,
            typingMs: 1000,
            content: (
                <>
                    <div className="flex items-center gap-2 mb-3 text-emerald-600">
                        <Sparkles className="size-4" />
                        <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">Lançamento Parcelado</span>
                    </div>
                    <p className="text-[15px] leading-relaxed mb-4 text-stone-700">
                        Lançado! Distribuí 3 parcelas de <strong className="text-stone-900 font-semibold">R$ 29,96</strong> na fatura do seu <strong className="text-purple-600 font-semibold">Nubank</strong> para os próximos meses.
                    </p>
                </>
            ),
        }
    ],
    [
        // Decision / Simulation Scenario
        {
            id: "sim-1",
            sender: "user",
            type: "text",
            delayMs: 1000,
            content: "Posso comprar um iPhone de R$ 5.000 em 12x?",
        },
        {
            id: "sim-2",
            sender: "bot",
            type: "text",
            delayMs: 2000,
            typingMs: 1500,
            content: (
                <>
                    <div className="flex items-center gap-2 mb-3 text-amber-600">
                        <AlertCircle className="size-4" />
                        <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600">Simulação de Risco</span>
                    </div>
                    <p className="text-[15px] leading-relaxed mb-4 text-stone-700">
                        Analisando seus gastos fixos e a meta <strong className="text-stone-900 font-semibold">Trocar de Carro</strong>... <span className="text-xl">🟡</span>
                    </p>
                    <div className="bg-amber-50 rounded-xl p-3 text-sm border border-amber-200 border-l-4 border-l-amber-500">
                        <p className="text-amber-900/90 text-[13px] leading-relaxed">
                            <strong>Cautela.</strong> Essa parcela de R$ 416,00 reduzirá sua sobra mensal real para apenas R$ 150,00 até o meio do ano.
                        </p>
                    </div>
                </>
            ),
        }
    ],
    [
        // Family Scenario
        {
            id: "fam-1",
            sender: "user",
            type: "text",
            delayMs: 1000,
            content: "Paguei a fatura da Internet, R$ 120,00.",
        },
        {
            id: "fam-2",
            sender: "bot",
            type: "text",
            delayMs: 1500,
            typingMs: 1000,
            content: (
                <>
                    <div className="flex items-center gap-2 mb-3 text-emerald-600">
                        <CheckCircle2 className="size-4" />
                        <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">Despesa Compartilhada</span>
                    </div>
                    <p className="text-[15px] leading-relaxed text-stone-700">
                        Registrado! Identifiquei a Tag de Conta Conjunta. O acerto de 50% (<strong className="text-emerald-700 font-semibold">R$ 60,00</strong>) já foi adicionado ao dashboard familiar.
                    </p>
                </>
            ),
        }
    ]
];

export function ChatDemo() {
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollEndRef = useRef<HTMLDivElement>(null);
    const [visibleMessages, setVisibleMessages] = useState<MessageNode[]>([]);
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        let isActive = true;
        const timeoutIds: NodeJS.Timeout[] = [];

        // Flatten all scenarios into a continuous timeline
        const feed = SCENARIOS.flat();
        let messageIndex = 0;

        const loopFeed = async () => {
            if (!isActive) return;

            const msg = feed[messageIndex];
            const baseDelay = msg.delayMs || 1000;
            // Aumentamos o delay adicional para dar tempo de ler as mensagens bem
            const extraReadTime = msg.type === "text" ? 2500 : 1500;

            // Se for bot, simula digitação
            if (msg.sender === "bot") {
                setIsTyping(true);
                await new Promise(r => {
                    const t = setTimeout(r, msg.typingMs || 1500);
                    timeoutIds.push(t);
                });
                if (!isActive) return;
                setIsTyping(false);
            } else {
                // Se for user, só espera um delay base
                await new Promise(r => {
                    const t = setTimeout(r, baseDelay + 1000);
                    timeoutIds.push(t);
                });
                if (!isActive) return;
            }

            // Exibe a mensagem real
            const newMessage = { ...msg, uniqueId: `${msg.id}-${Date.now()}` };
            setVisibleMessages((prev) => [...prev.slice(-10), newMessage]); // keep only last 10 messages for performance

            // Tempo extra para o usuário ler a mensagem recém chegada
            await new Promise(r => {
                const t = setTimeout(r, extraReadTime);
                timeoutIds.push(t);
            });
            if (!isActive) return;

            // Próxima mensagem
            messageIndex = (messageIndex + 1) % feed.length;
            loopFeed();
        };

        loopFeed();

        return () => {
            isActive = false;
            timeoutIds.forEach(clearTimeout);
        };
    }, []);

    // Auto-scroll to bottom whenever visibleMessages or isTyping changes
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [visibleMessages, isTyping]);

    useGSAP(() => {
        gsap.from(".chat-bubble-enter", {
            opacity: 0,
            y: 20,
            scale: 0.95,
            duration: 0.5,
            ease: "back.out(1.2)",
        });
    }, { scope: containerRef, dependencies: [visibleMessages] });

    return (
        <div className="flex-1 bg-[#efeae2] p-4 sm:p-5 flex flex-col gap-5 bg-cover bg-blend-soft-light relative overflow-y-auto scrollbar-hide"
            style={{ backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.03) 1px, transparent 1px)", backgroundSize: "20px 20px", scrollbarWidth: "none", msOverflowStyle: "none" }}
            ref={containerRef}>

            <div className="chat-bubbles-container flex flex-col gap-4 justify-end min-h-full">
                {visibleMessages.map((msg: MessageNode, idx) => (
                    <div key={msg.uniqueId || idx} className={`chat-bubble-enter flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}>

                        {/* User Bubble */}
                        {msg.sender === "user" && msg.type === "text" && (
                            <div className="bg-[#d9fdd3] text-[#111b21] rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm relative">
                                <p className="text-[15px] leading-relaxed">{msg.content}</p>
                                <div className="flex justify-end mt-1.5 gap-1 items-center">
                                    <span className="text-[10px] text-stone-500 font-medium opacity-80">Agora</span>
                                    <svg viewBox="0 0 16 15" width="16" height="15" className="text-info fill-current opacity-80" style={{ color: "#53bdeb" }}><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"></path></svg>
                                </div>
                            </div>
                        )}

                        {msg.sender === "user" && msg.type === "audio" && (
                            <div className="bg-[#d9fdd3] text-[#111b21] rounded-2xl rounded-tr-sm px-3 py-2.5 max-w-[85%] shadow-sm relative flex items-center gap-3 w-64">
                                <div className="size-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 shadow">
                                    <Mic className="size-5 text-white" />
                                </div>
                                <div className="flex-1">
                                    <div className="w-full flex items-center gap-1">
                                        <span className="size-1.5 rounded-full bg-emerald-600 opacity-50" />
                                        <span className="size-1.5 rounded-full bg-emerald-600 opacity-70" />
                                        <span className="size-1.5 rounded-full bg-emerald-600 opacity-100" />
                                        <span className="size-1.5 rounded-full bg-emerald-600 opacity-60" />
                                        <span className="size-1.5 rounded-full bg-emerald-600 opacity-80" />
                                        <span className="size-1.5 rounded-full bg-emerald-600 opacity-40" />
                                        <span className="size-1.5 rounded-full bg-emerald-600 opacity-90" />
                                    </div>
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="text-[10px] text-stone-500 font-medium opacity-80">0:04</span>
                                        <svg viewBox="0 0 16 15" width="14" height="13" className="fill-current opacity-80" style={{ color: "#53bdeb" }}><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"></path></svg>
                                    </div>
                                </div>
                            </div>
                        )}

                        {msg.sender === "user" && msg.type === "image" && (
                            <div className="bg-[#d9fdd3] text-[#111b21] rounded-2xl rounded-tr-sm p-1 max-w-[85%] shadow-sm relative">
                                <div className="w-[180px] h-[120px] bg-stone-200 rounded-xl overflow-hidden relative flex items-center justify-center border border-black/5">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-stone-200 to-stone-100 opacity-50" />
                                    <Camera className="size-8 text-stone-400 opacity-60 relative z-10" />
                                    <span className="absolute bottom-2 left-2 text-[10px] font-medium text-stone-500">Foto_recibo.jpg</span>
                                </div>
                                <div className="flex justify-end mt-1 gap-1 items-center px-2 pb-1">
                                    <span className="text-[10px] text-stone-500 font-medium opacity-80">Agora</span>
                                    <svg viewBox="0 0 16 15" width="16" height="15" className="text-info fill-current opacity-80" style={{ color: "#53bdeb" }}><path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"></path></svg>
                                </div>
                            </div>
                        )}

                        {/* Bot Bubble */}
                        {msg.sender === "bot" && (
                            <div className="bg-white text-[#111b21] rounded-2xl rounded-tl-sm px-4 sm:px-5 py-4 sm:py-5 max-w-[92%] shadow-sm mt-1">
                                {msg.content}
                                <div className="flex justify-end mt-3">
                                    <span className="text-[10px] text-stone-500 font-medium">Agora</span>
                                </div>
                            </div>
                        )}

                    </div>
                ))}

                {/* Typing indicator */}
                {isTyping && (
                    <div className="chat-bubble-enter self-start bg-white text-[#111b21] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm mt-1">
                        <div className="flex items-center gap-1.5 h-4">
                            <span className="size-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <span className="size-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <span className="size-1.5 bg-stone-400 rounded-full animate-bounce" />
                        </div>
                    </div>
                )}

                {/* Element to anchor the scroll */}
                <div ref={scrollEndRef} className="h-1 w-full" />
            </div>
        </div>
    );
}
