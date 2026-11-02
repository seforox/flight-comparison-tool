"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, FlightAlert, UserProfile, AlertStatus } from "@/lib/api";
import { AgentChatbot } from "@/components/AgentChatbot";
import { CreateAlertForm } from "@/components/CreateAlertForm";
import { AlertCard } from "@/components/AlertCard";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [alerts, setAlerts] = useState<FlightAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatorTab, setCreatorTab] = useState<"agent" | "form">("agent");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AlertStatus>("ALL");

  // Modal de configuración de Telegram
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramInput, setTelegramInput] = useState("");
  const [savingTelegram, setSavingTelegram] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [profileData, alertsData] = await Promise.all([
        api.auth.getProfile(),
        api.alerts.list(),
      ]);
      setUser(profileData);
      setTelegramInput(profileData.telegramChatId || "");
      setAlerts(alertsData);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
    // Auto-refresco suave cada 15 segundos por si el worker en segundo plano actualiza una alerta a TRIGGERED
    const interval = setInterval(() => {
      api.alerts.list().then(setAlerts).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleLogout = async () => {
    await api.auth.logout();
    router.push("/login");
  };

  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTelegram(true);
    try {
      const updated = await api.auth.updateTelegram(telegramInput.trim());
      setUser(updated);
      setShowTelegramModal(false);
    } finally {
      setSavingTelegram(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span className="w-3 h-3 rounded-full bg-sky-400 animate-ping" />
          Cargando radar de vuelos...
        </div>
      </div>
    );
  }

  const filteredAlerts =
    statusFilter === "ALL"
      ? alerts
      : alerts.filter((a) => a.status === statusFilter);

  const totalMatches = alerts.reduce((acc, a) => acc + (a.matches?.length || 0), 0);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Barra superior (Header) */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/20">
              <span className="text-lg">✈️</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-none">
                SkyRadar AI
              </h1>
              <span className="text-[11px] text-slate-400">
                Monitorización Recurrente de Vuelos
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Botón de estado de Telegram */}
            <button
              type="button"
              onClick={() => setShowTelegramModal(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-2 transition cursor-pointer ${
                user?.telegramChatId
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
              }`}
            >
              <span>📲</span>
              <span>
                {user?.telegramChatId
                  ? `Telegram: ${user.telegramChatId}`
                  : "Vincular Telegram"}
              </span>
            </button>

            <div className="hidden sm:block text-xs text-slate-400 border-l border-slate-800 pl-3">
              {user?.email}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-500/15 border border-slate-800 hover:border-rose-500/30 text-xs text-slate-300 hover:text-rose-300 transition cursor-pointer"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Métricas rápidas superiores */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
            <span className="text-xs text-slate-400">Total Alertas</span>
            <p className="text-2xl font-bold text-white mt-1">{alerts.length}</p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
            <span className="text-xs text-sky-400">Monitorizando (Activas)</span>
            <p className="text-2xl font-bold text-sky-300 mt-1">
              {alerts.filter((a) => a.status === "ACTIVE").length}
            </p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
            <span className="text-xs text-emerald-400">Alertas Disparadas 🔔</span>
            <p className="text-2xl font-bold text-emerald-300 mt-1">
              {alerts.filter((a) => a.status === "TRIGGERED").length}
            </p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
            <span className="text-xs text-indigo-400">Chollos Encontrados</span>
            <p className="text-2xl font-bold text-indigo-300 mt-1">
              {totalMatches}
            </p>
          </div>
        </div>

        {/* Grid principal: Izquierda Creador Dual (Chatbot / Formulario) | Derecha Mis Alertas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Columna Izquierda (5 cols): Selector entre Agente IA y Formulario Manual */}
          <div className="lg:col-span-5 space-y-3">
            <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setCreatorTab("agent")}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  creatorTab === "agent"
                    ? "bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>🤖</span>
                <span>Chatbot Agente IA</span>
              </button>
              <button
                type="button"
                onClick={() => setCreatorTab("form")}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  creatorTab === "form"
                    ? "bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>📋</span>
                <span>Formulario Manual</span>
              </button>
            </div>

            {creatorTab === "agent" ? (
              <AgentChatbot onAlertCreated={loadData} />
            ) : (
              <CreateAlertForm onAlertCreated={loadData} />
            )}
          </div>

          {/* Columna Derecha (7 cols): Listado de Alertas y Chollos */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
              <div>
                <h2 className="text-sm font-bold text-white">
                  Mis Alertas de Vuelos
                </h2>
                <p className="text-xs text-slate-400">
                  Gestiona el ciclo de vida de tus búsquedas y explora los enlaces de reserva
                </p>
              </div>

              {/* Filtros por estado */}
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { key: "ALL", label: "Todas" },
                    { key: "ACTIVE", label: "Activas" },
                    { key: "TRIGGERED", label: "Disparadas 🔔" },
                    { key: "PAUSED", label: "Pausadas" },
                    { key: "COMPLETED", label: "Completadas" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatusFilter(tab.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                      statusFilter === tab.key
                        ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredAlerts.length === 0 ? (
              <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
                <div className="text-3xl mb-2">📡</div>
                <h3 className="text-sm font-semibold text-slate-200">
                  No hay alertas en esta vista
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Pídele al Chatbot IA que te recomiende 5 destinos económicos o crea una alerta con tus días de la semana favoritos.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAlerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onRefresh={loadData}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal para vincular Telegram Chat ID */}
      {showTelegramModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>📲</span> Configurar Notificaciones de Telegram
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Para recibir los chollos con aerolínea, escalas, hora de salida y enlace directo en tu móvil:
            </p>
            <ol className="text-xs text-slate-300 mt-3 space-y-1.5 list-decimal list-inside bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
              <li>Abre tu bot en Telegram y pulsa <strong>Iniciar (/start)</strong>.</li>
              <li>Introduce abajo tu <strong>Chat ID numérico</strong> (ej. <code className="text-sky-300">1418929473</code>).</li>
            </ol>

            <form onSubmit={handleSaveTelegram} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Tu Telegram Chat ID
                </label>
                <input
                  type="text"
                  required
                  value={telegramInput}
                  onChange={(e) => setTelegramInput(e.target.value)}
                  placeholder="Ej: 1418929473"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTelegramModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingTelegram}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-xs font-semibold text-white cursor-pointer"
                >
                  {savingTelegram ? "Guardando..." : "Guardar Chat ID"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
