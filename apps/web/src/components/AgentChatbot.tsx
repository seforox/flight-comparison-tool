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

const QUICK_PROMPTS = [
  {
    label: "🏖️ 5 sitios baratos con playa",
    prompt: "Recomiéndame 5 sitios baratos con playa para escaparme",
  },
  {
    label: "🏔️ 5 destinos de montaña",
    prompt: "Busco sitios baratos de montaña en Europa",
  },
  {
    label: "✈️ MAD ➔ LON (Lunes a Miércoles < 85€)",
    prompt:
      "Vuelos de MAD a LON saliendo el lunes y volviendo el miercoles para 2 personas por menos de 85 euros en noviembre de este año",
  },
];

export function AgentChatbot({ onAlertCreated }: AgentChatbotProps) {
  const [sessionId, setSessionId] = useState<string>(() => `web-chat-${Date.now()}`);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "¡Hola! Soy tu Agente IA de vuelos con 2 especializaciones:\n• **Recomendador Inspiracional:** Pídeme 5 destinos baratos de playa, montaña o escapada.\n• **Búsqueda Definida:** Dime directamente tu ruta, días de la semana, mes y presupuesto.",
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

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
          text: `⚠️ Error al comunicar con el agente: ${err.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSession = () => {
    setSessionId(`web-chat-${Date.now()}`);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        text: "🔄 Nueva sesión iniciada. ¿Prefieres que te recomiende 5 destinos o configuramos una ruta directa?",
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[580px] bg-slate-950/60 border border-slate-800/90 rounded-2xl overflow-hidden">
      {/* Cabecera del Chatbot */}
      <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <h3 className="text-xs font-semibold text-white flex items-center gap-2">
              Agente IA Multi-Skill
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-[10px] text-indigo-300">
                SKILL.md Activo
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Búsqueda Definida & Recomendador de 5 destinos
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetSession}
          className="text-[11px] text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-800 transition cursor-pointer"
        >
          Reiniciar chat
        </button>
      </div>

      {/* Botones rápidos de prueba */}
      <div className="px-3 py-2 bg-slate-900/40 border-b border-slate-800/60 flex items-center gap-1.5 overflow-x-auto">
        {QUICK_PROMPTS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => sendMessage(item.prompt)}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-sky-500/15 border border-slate-800 hover:border-sky-500/40 text-[11px] text-slate-300 hover:text-sky-200 transition cursor-pointer"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Historial de mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-br-xs shadow-md"
                  : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-xs"
              }`}
            >
              {msg.skill && (
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                      msg.skill === "DESTINATION_RECOMMENDER"
                        ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                        : "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                    }`}
                  >
                    {msg.skill === "DESTINATION_RECOMMENDER"
                      ? "🌟 Skill: Recomendador"
                      : "🎯 Skill: Búsqueda Definida"}
                  </span>
                </div>
              )}

              <div className="whitespace-pre-line">{msg.text}</div>

              {/* Tarjetas interactivas de las 5 recomendaciones */}
              {msg.recommendations && msg.recommendations.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-[11px] font-medium text-sky-300">
                    Haz clic en un destino para seleccionarlo:
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {msg.recommendations.map((rec) => (
                      <button
                        key={rec.iataCode}
                        type="button"
                        onClick={() =>
                          sendMessage(
                            `Me quedo con ${rec.city} (${rec.iataCode}) saliendo desde MAD de viernes a domingo en noviembre de este año por menos de ${
                              rec.estimatedPriceEur + 30
                            } euros`
                          )
                        }
                        className="text-left p-2.5 rounded-xl bg-slate-950/90 hover:bg-sky-500/15 border border-slate-800 hover:border-sky-500/40 transition group cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white group-hover:text-sky-300 text-xs">
                            {rec.city}{" "}
                            <span className="font-mono text-sky-400">
                              ({rec.iataCode})
                            </span>{" "}
                            · <span className="text-slate-400 font-normal">{rec.country}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-semibold text-[11px]">
                            ~{rec.estimatedPriceEur}€
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {rec.reason}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Botones de confirmación rápida cuando awaitingConfirmation = true */}
              {msg.awaitingConfirmation && (
                <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => sendMessage("Sí, lánzala")}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition shadow-md shadow-emerald-500/20 cursor-pointer"
                  >
                    🚀 Sí, lanzar y encolar alerta
                  </button>
                  <button
                    type="button"
                    onClick={() => sendMessage("No, quiero modificar un dato")}
                    className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                  >
                    ✏️ Modificar
                  </button>
                </div>
              )}

              {msg.alertCreated && (
                <div className="mt-2.5 p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium">
                  ✅ Alerta guardada en PostgreSQL y enviada a la cola BullMQ.
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
              Analizando con el motor de Skills...
            </div>
          </div>
        )}
      </div>

      {/* Input de envío */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu búsqueda o pide 5 recomendaciones (ej. playa, montaña)..."
          className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs transition disabled:opacity-40 cursor-pointer"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
