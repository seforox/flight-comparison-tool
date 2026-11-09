"use client";

import React, { useState, useRef, useEffect } from "react";
import { api, DestinationRecommendation } from "@/lib/api";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  skill?: "DEFINED_SEARCH" | "DESTINATION_RECOMMENDER";
  recommendations?: DestinationRecommendation[];
  awaitingConfirmation?: boolean;
  alertCreated?: boolean;
}

interface AgentChatbotProps {
  onAlertCreated: () => void;
}

const SUGGESTED_PROMPTS = [
  {
    label: "Vuelos baratos a Roma de viernes a domingo en noviembre",
    prompt:
      "Vuelos de MAD a ROM saliendo el viernes y volviendo el domingo para 1 persona por menos de 95 euros en noviembre de este año",
  },
  {
    label: "Escapada de finde de Barcelona a Lisboa por menos de 80 €",
    prompt:
      "Vuelos de BCN a LIS saliendo el viernes y volviendo el domingo para 1 persona por menos de 80 euros en noviembre de este año",
  },
  {
    label: "Madrid a Nueva York en agosto, 2 personas, directo",
    prompt:
      "Vuelos de MAD a JFK saliendo el lunes y volviendo el domingo para 2 personas por menos de 450 euros en agosto de este año",
  },
  {
    label: "✨ Recomiéndame 5 destinos baratos de playa o montaña",
    prompt: "Recomiéndame 5 sitios baratos con playa para escaparme",
  },
];

export function AgentChatbot({ onAlertCreated }: AgentChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>(
    () => `vera-chat-${Date.now()}`
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "¡Hola! Soy Vera, tu Agente IA de vuelos. Dime adónde quieres volar y qué días te vienen bien, o pídeme que te recomiende 5 destinos económicos.",
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.agent.chat(trimmed, sessionId);

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        text: res.reply,
        skill: res.activeSkill,
        recommendations: res.recommendations,
        awaitingConfirmation: res.awaitingConfirmation,
        alertCreated: res.alertCreated,
      };

      setMessages((prev) => [...prev, botMsg]);

      if (res.alertCreated) {
        onAlertCreated();
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: `⚠️ No he podido procesar tu mensaje: ${err.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSession = () => {
    setSessionId(`vera-chat-${Date.now()}`);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        text: "¡Hola! Soy Vera, tu Agente IA de vuelos. Dime adónde quieres volar y qué días te vienen bien, o pídeme que te recomiende 5 destinos económicos.",
      },
    ]);
  };

  // Vista minimizada en la esquina inferior derecha (responsiva en móvil)
  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-5 sm:right-5 z-50 flex justify-end pointer-events-none">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-expanded="false"
          aria-label="Abrir chat con Vera, Agente IA de vuelos"
          className="pointer-events-auto group flex items-center gap-3 pl-3.5 pr-4 py-3 rounded-3xl bg-gradient-to-r from-[#0b2545] via-[#0d3b66] to-[#0077b6] hover:from-[#091e3a] hover:to-[#0096c7] text-white shadow-[0_16px_40px_rgba(11,37,69,0.35)] border border-cyan-300/30 transition-all hover:scale-[1.02] cursor-pointer text-left w-full sm:w-auto sm:max-w-sm"
        >
          {/* Icono del Agente IA con indicador activo */}
          <div className="relative shrink-0" aria-hidden="true">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-cyan-300 shadow-inner">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L14.4 7.6L20 10L14.4 12.4L12 18L9.6 12.4L4 10L9.6 7.6L12 2ZM19 15L20.1 17.4L22.5 18.5L20.1 19.6L19 22L17.9 19.6L15.5 18.5L17.9 17.4L19 15ZM6 16L6.8 17.7L8.5 18.5L6.8 19.3L6 21L5.2 19.3L3.5 18.5L5.2 17.7L6 16Z" />
              </svg>
            </div>
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-400 border-2 border-[#0b2545]" />
            </span>
          </div>

          {/* Información clara de que es un Chat de Agente IA */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold tracking-tight text-white">
                Vera · Agente IA
              </span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-400/20 border border-cyan-300/30 text-[10px] font-bold text-cyan-200 uppercase tracking-wide">
                Chat IA
              </span>
            </div>
            <p className="text-xs text-sky-100/90 mt-0.5 leading-snug truncate sm:whitespace-normal">
              Crea alertas hablando o pídeme 5 destinos baratos
            </p>
          </div>

          {/* Flecha de abrir */}
          <div
            aria-hidden="true"
            className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center text-cyan-200 shrink-0 transition"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 15l7-7 7 7"
              />
            </svg>
          </div>
        </button>
      </div>
    );
  }

  // Vista desplegada flotante en la esquina inferior derecha
  return (
    <section
      role="dialog"
      aria-label="Chat con Vera, Agente IA de vuelos"
      className="fixed bottom-3 right-3 left-3 sm:left-auto sm:bottom-5 sm:right-5 z-50 sm:w-[410px] h-[590px] max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-5rem)] flex flex-col bg-white border border-slate-200 rounded-3xl shadow-[0_24px_60px_rgba(11,37,69,0.28)] overflow-hidden"
    >
      {/* Cabecera azul degradada con controles accesibles sin botones anidados */}
      <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-[#0e325c] via-[#0b4d83] to-[#0873b9] flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0" aria-hidden="true">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-cyan-300 shadow-inner">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L14.4 7.6L20 10L14.4 12.4L12 18L9.6 12.4L4 10L9.6 7.6L12 2ZM19 15L20.1 17.4L22.5 18.5L20.1 19.6L19 22L17.9 19.6L15.5 18.5L17.9 17.4L19 15ZM6 16L6.8 17.7L8.5 18.5L6.8 19.3L6 21L5.2 19.3L3.5 18.5L5.2 17.7L6 16Z" />
              </svg>
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0e325c]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight truncate">
                Vera · Agente IA
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-semibold text-cyan-200 shrink-0">
                Multi-Skill
              </span>
            </div>
            <p className="text-xs text-sky-100/85 truncate">
              Pídeme búsquedas o destinos en lenguaje natural
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {messages.length > 1 && (
            <button
              type="button"
              onClick={handleResetSession}
              aria-label="Reiniciar conversación con Vera"
              className="text-[11px] text-sky-100 hover:text-white px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 transition cursor-pointer"
            >
              Reiniciar
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Minimizar chat del Agente IA"
            title="Minimizar chat (Esc)"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Área de mensajes con role="log" y aria-live="polite" */}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="Historial de conversación con Vera"
        className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-white"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[92%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#0d3b66] text-white rounded-br-xs shadow-xs"
                  : "bg-[#f1f5f9] text-[#0b2545] rounded-tl-xs"
              }`}
            >
              {msg.skill && (
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      msg.skill === "DESTINATION_RECOMMENDER"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-cyan-100 text-[#0077b6]"
                    }`}
                  >
                    {msg.skill === "DESTINATION_RECOMMENDER"
                      ? "✨ Inspiración · 5 Destinos"
                      : "🛫 Búsqueda Definida"}
                  </span>
                </div>
              )}

              <div className="whitespace-pre-line">{msg.text}</div>

              {/* Tarjetas interactivas de las 5 recomendaciones */}
              {msg.recommendations && msg.recommendations.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-[11px] font-semibold text-[#0077b6]">
                    Elige uno de estos destinos para preparar tu alerta:
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {msg.recommendations.map((rec) => (
                      <button
                        key={rec.iataCode}
                        type="button"
                        onClick={() =>
                          sendMessage(
                            `Me quedo con ${rec.city} (${rec.iataCode})`
                          )
                        }
                        className="text-left p-2.5 rounded-xl bg-white hover:bg-sky-50 border border-slate-200 hover:border-cyan-400 transition group cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#0b2545] group-hover:text-[#0077b6] text-xs">
                            {rec.city}{" "}
                            <span className="font-mono text-[#0096c7]">
                              ({rec.iataCode})
                            </span>{" "}
                            ·{" "}
                            <span className="text-slate-600 font-normal">
                              {rec.country}
                            </span>
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px] shrink-0">
                            desde {rec.estimatedPriceEur} €
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1">
                          {rec.reason}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Botones de confirmación rápida */}
              {msg.awaitingConfirmation && (
                <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => sendMessage("Sí, lánzala")}
                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-[#0e3968] to-[#00a8e8] hover:opacity-95 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
                  >
                    ✓ Sí, activar alerta
                  </button>
                  <button
                    type="button"
                    onClick={() => sendMessage("No, quiero modificar un dato")}
                    className="py-2 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium transition cursor-pointer"
                  >
                    Modificar
                  </button>
                </div>
              )}

              {msg.alertCreated && (
                <div
                  role="status"
                  className="mt-2.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold"
                >
                  ✓ Búsqueda añadida a «Tus búsquedas» y monitorizándose.
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start" role="status" aria-live="polite">
            <div className="bg-[#f1f5f9] rounded-2xl px-4 py-2.5 text-xs text-slate-600 flex items-center gap-2">
              <span
                aria-hidden="true"
                className="w-2 h-2 rounded-full bg-[#00a8e8] animate-ping"
              />
              Vera está preparando tu búsqueda...
            </div>
          </div>
        )}
      </div>

      {/* Píldoras de sugerencias e input inferior */}
      <div className="p-3.5 border-t border-slate-100 bg-white space-y-2.5">
        <div
          role="group"
          aria-label="Sugerencias de consulta rápida"
          className="flex flex-col items-start gap-1.5 max-h-24 overflow-y-auto"
        >
          {SUGGESTED_PROMPTS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => sendMessage(item.prompt)}
              className="text-left px-3 py-1 rounded-full bg-[#f4f7fb] hover:bg-sky-50 border border-slate-200/80 hover:border-cyan-300 text-[11px] font-medium text-[#0b2545] transition cursor-pointer truncate max-w-full"
            >
              {item.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="relative flex items-center gap-2"
        >
          <label htmlFor="vera-chat-input" className="sr-only">
            Escribe tu mensaje para Vera
          </label>
          <input
            id="vera-chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ej.: vuelos a Roma de viernes a domingo en noviembre..."
            className="w-full pl-3.5 pr-20 py-2.5 rounded-2xl bg-[#f8fafc] border border-slate-200 text-xs text-[#0b2545] placeholder-slate-400 focus:outline-none focus:border-[#0096c7]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="absolute right-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#0e3968] to-[#00a8e8] text-white font-semibold text-xs transition disabled:opacity-40 cursor-pointer"
          >
            Enviar
          </button>
        </form>
      </div>
    </section>
  );
}
