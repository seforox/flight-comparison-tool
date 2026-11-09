"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  api,
  FlightAlert,
  UserProfile,
  getCachedAirport,
} from "@/lib/api";
import { AgentChatbot } from "@/components/AgentChatbot";
import { CreateAlertForm } from "@/components/CreateAlertForm";
import { LandingView } from "@/components/LandingView";
import {
  AlertCard,
  STATUS_PILLS,
  formatShortDate,
  getBestPriceForAlert,
} from "@/components/AlertCard";

export default function DashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [alerts, setAlerts] = useState<FlightAlert[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [navTab, setNavTab] = useState<"comparador" | "alertas">("comparador");
  const [dismissToast, setDismissToast] = useState(false);

  // Modal de configuración de Telegram
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramInput, setTelegramInput] = useState("");
  const [savingTelegram, setSavingTelegram] = useState(false);

  const searchesSectionRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    try {
      const [profileData, alertsData] = await Promise.all([
        api.auth.getProfile(),
        api.alerts.list(),
      ]);
      setUser(profileData);
      setTelegramInput(profileData.telegramChatId || "");
      setAlerts(alertsData);
      setSelectedAlertId((prev) => {
        if (prev && alertsData.some((a) => a.id === prev)) return prev;
        return alertsData[0]?.id || null;
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (!localStorage.getItem("flight_jwt_token")) return;
      api.alerts
        .list()
        .then((data) => {
          setAlerts(data);
          setSelectedAlertId((prev) => {
            if (prev && data.some((a) => a.id === prev)) return prev;
            return data[0]?.id || null;
          });
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if (!showTelegramModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowTelegramModal(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showTelegramModal]);

  const handleLogout = async () => {
    await api.auth.logout();
    setUser(null);
    setAlerts([]);
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

  const [resolvedCities, setResolvedCities] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    const codes = new Set<string>();
    for (const a of alerts) {
      if (a.originIata && !getCachedAirport(a.originIata)) codes.add(a.originIata);
      if (a.destinationIata && !getCachedAirport(a.destinationIata)) codes.add(a.destinationIata);
    }
    codes.forEach((code) => {
      api.airports.getByIata(code).then((found) => {
        if (active && found) {
          setResolvedCities((prev) => ({ ...prev, [code.toUpperCase()]: found.city }));
        }
      });
    });
    return () => {
      active = false;
    };
  }, [alerts]);

  const getCityName = (iata: string) =>
    getCachedAirport(iata)?.city || resolvedCities[iata?.toUpperCase()] || iata;

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="min-h-screen flex items-center justify-center bg-[#f4f7fb]"
      >
        <div className="flex items-center gap-3 text-sm font-medium text-[#0b2545]">
          <span
            aria-hidden="true"
            className="w-3 h-3 rounded-full bg-[#00a8e8] animate-ping"
          />
          Cargando V Flights...
        </div>
      </div>
    );
  }

  // Si el usuario no ha iniciado sesión, mostramos la Landing Page pública de V Flights
  if (!user) {
    return <LandingView />;
  }

  const searchingCount = alerts.filter((a) => a.status === "ACTIVE").length;
  const foundCount = alerts.filter((a) => a.status === "TRIGGERED").length;
  const activeOrTriggeredCount = alerts.filter(
    (a) => a.status === "ACTIVE" || a.status === "TRIGGERED"
  ).length;

  const selectedAlert =
    alerts.find((a) => a.id === selectedAlertId) || alerts[0] || null;

  const featuredTriggeredAlert =
    alerts.find((a) => a.status === "TRIGGERED") || null;

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f7fb] text-[#0b2545]">
      {/* Barra superior blanca (Navbar estilo V Flights, responsiva en móvil y escritorio) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-0 sm:h-20 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Logo V Flights */}
            <div className="flex items-center gap-3">
              <img
                src="/logo.jpg"
                alt="Logo de V Flights"
                className="h-12 sm:h-15 w-auto object-contain"
              />
              <span className="text-lg sm:text-xl font-extrabold tracking-tight text-[#0b2545]">
                V Flights
              </span>
            </div>

            {/* Pestañas de navegación */}
            <nav
              aria-label="Navegación principal del panel"
              className="hidden md:flex items-center gap-2"
            >
              <button
                type="button"
                aria-current={navTab === "comparador" ? "page" : undefined}
                onClick={() => setNavTab("comparador")}
                className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                  navTab === "comparador"
                    ? "bg-[#0e2a47] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span aria-hidden="true">🛫</span>
                <span>Comparador de vuelos</span>
              </button>

              <button
                type="button"
                aria-current={navTab === "alertas" ? "page" : undefined}
                onClick={() => {
                  setNavTab("alertas");
                  searchesSectionRef.current?.scrollIntoView({
                    behavior: "smooth",
                  });
                }}
                className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                  navTab === "alertas"
                    ? "bg-[#0e2a47] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span aria-hidden="true">🔔</span>
                <span>Mis alertas</span>
                <span className="px-1.5 py-0.5 rounded-full bg-[#00c4e0] text-[#07223b] font-extrabold text-[10px] leading-none">
                  {activeOrTriggeredCount}
                </span>
              </button>
            </nav>
          </div>

          {/* Derecha: Estado de alertas activas + Telegram + Salir */}
          <div className="flex items-center gap-2">
            <div className="hidden lg:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-[#0b2545] shadow-2xs">
              <span aria-hidden="true" className="w-2 h-2 rounded-full bg-[#00b4d8]" />
              <span>{activeOrTriggeredCount} alertas activas</span>
            </div>

            <button
              type="button"
              onClick={() => setShowTelegramModal(true)}
              aria-label={
                user?.telegramChatId
                  ? `Configurar Telegram (actualmente vinculado: ${user.telegramChatId})`
                  : "Vincular cuenta de Telegram para recibir alertas"
              }
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition cursor-pointer ${
                user?.telegramChatId
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                  : "bg-sky-50 border-sky-200 text-[#0077b6] hover:bg-sky-100"
              }`}
            >
              <span aria-hidden="true">📲</span>
              <span>
                {user?.telegramChatId ? "Telegram" : "Vincular Telegram"}
              </span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              aria-label={`Cerrar sesión (${user?.email || ""})`}
              className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-rose-50 text-xs font-semibold text-slate-700 hover:text-rose-600 transition cursor-pointer"
            >
              Salir
            </button>
          </div>

          {/* Barra de pestañas visible en móvil (<768px) */}
          <nav
            aria-label="Navegación móvil"
            className="flex md:hidden w-full items-center gap-2 pt-2 border-t border-slate-100"
          >
            <button
              type="button"
              aria-current={navTab === "comparador" ? "page" : undefined}
              onClick={() => setNavTab("comparador")}
              className={`flex-1 justify-center px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                navTab === "comparador"
                  ? "bg-[#0e2a47] text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              <span aria-hidden="true">🛫</span>
              <span>Comparador</span>
            </button>

            <button
              type="button"
              aria-current={navTab === "alertas" ? "page" : undefined}
              onClick={() => {
                setNavTab("alertas");
                searchesSectionRef.current?.scrollIntoView({
                  behavior: "smooth",
                });
              }}
              className={`flex-1 justify-center px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                navTab === "alertas"
                  ? "bg-[#0e2a47] text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              <span aria-hidden="true">🔔</span>
              <span>Mis alertas ({activeOrTriggeredCount})</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Sección HERO Azul Marino con Pájaros Origami y Buscador */}
      {navTab === "comparador" && (
        <section
          aria-label="Buscador principal de vuelos"
          className="relative bg-gradient-to-br from-[#071932] via-[#0c2b53] to-[#0d3b6e] pt-8 sm:pt-10 pb-10 sm:pb-12 overflow-hidden"
        >
          {/* Resplandor radial cian y siluetas de aves estilo origami a la derecha */}
          <div
            aria-hidden="true"
            className="pointer-events-none select-none absolute inset-0 overflow-hidden"
          >
            <div className="absolute right-[8%] top-6 w-[440px] h-[440px] rounded-full bg-[#00b4d8]/15 blur-3xl" />
            <svg
              className="hidden lg:block absolute right-[6%] top-6 w-[460px] h-[270px] text-[#00b4d8]"
              viewBox="0 0 460 270"
              fill="currentColor"
            >
              <path
                opacity="0.75"
                d="M270 190 L330 135 L312 118 L345 122 L390 95 L350 148 L382 172 L334 162 Z"
              />
              <path
                opacity="0.45"
                d="M165 205 L210 162 L195 148 L222 152 L255 130 L226 172 L248 190 L212 182 Z"
              />
              <path
                opacity="0.6"
                d="M220 112 L252 80 L240 68 L262 72 L288 55 L265 88 L282 102 L255 95 Z"
              />
              <path
                opacity="0.55"
                d="M248 45 L268 24 L260 16 L276 19 L294 8 L278 30 L290 40 L270 35 Z"
              />
              <path
                opacity="0.65"
                d="M340 82 L378 44 L364 30 L390 34 L424 14 L394 54 L416 70 L382 62 Z"
              />
              <path
                opacity="0.5"
                d="M385 182 L412 155 L402 145 L420 148 L442 134 L422 162 L436 174 L414 168 Z"
              />
            </svg>
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
            {/* Píldora superior */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-medium text-sky-200 mb-4">
              <span aria-hidden="true" className="text-[#18c1f0]">
                🛫
              </span>
              <span>Monitorización inteligente de vuelos</span>
            </div>

            {/* Titular principal */}
            <h1 className="text-2xl sm:text-5xl font-extrabold text-white tracking-tight max-w-2xl leading-[1.14]">
              Vuela cuando sea{" "}
              <span className="text-[#18c1f0]">más barato</span>, no solo cuando
              toca.
            </h1>

            {/* Subtítulo */}
            <p className="text-xs sm:text-base text-sky-100/85 max-w-xl mt-3 leading-relaxed">
              Compara tus fechas de un vistazo, deja que Vera prepare tus
              búsquedas y recibe el estado de cada alerta.
            </p>

            {/* Contadores en píldoras */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 mt-5 mb-6 sm:mb-8">
              <div className="px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-medium text-sky-100 flex items-center gap-1.5">
                <strong className="text-[#18c1f0] font-extrabold text-sm">
                  {searchingCount}
                </strong>
                <span>buscando</span>
              </div>
              <div className="px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-medium text-sky-100 flex items-center gap-1.5">
                <strong className="text-[#18c1f0] font-extrabold text-sm">
                  {foundCount}
                </strong>
                <span>vuelos encontrados</span>
              </div>
            </div>

            {/* Tarjeta blanca del buscador */}
            <CreateAlertForm onAlertCreated={loadData} />
          </div>
        </section>
      )}

      {/* Contenido Principal: "Tus búsquedas" a ancho completo + Chat flotante en esquina inferior derecha */}
      <main
        id="main-content"
        ref={searchesSectionRef}
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-32"
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold text-[#0b2545] tracking-tight">
              Tus búsquedas
            </h2>
            <span className="text-xs font-medium text-slate-500">
              {alerts.length} activas o archivadas
            </span>
          </div>

          {alerts.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-12 text-center shadow-xs">
              <div aria-hidden="true" className="text-3xl mb-2">
                🛫
              </div>
              <h3 className="text-base font-bold text-[#0b2545]">
                Aún no tienes búsquedas creadas
              </h3>
              <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                Usa el buscador superior o abre el chat de Vera en la esquina
                inferior derecha para preparar tu primera alerta.
              </p>
            </div>
          ) : (
            <>
              {/* Fila de mini-tarjetas seleccionables */}
              <div
                role="group"
                aria-label="Lista de tus alertas de vuelo"
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5"
              >
                {alerts.map((item) => {
                  const isSelected = selectedAlert?.id === item.id;
                  const pill = STATUS_PILLS[item.status] || STATUS_PILLS.ACTIVE;
                  const displayPrice = getBestPriceForAlert(item);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedAlertId(item.id)}
                      className={`text-left rounded-2xl p-4 bg-white transition-all cursor-pointer border ${
                        isSelected
                          ? "border-[#2596d4] ring-2 ring-[#2596d4]/15 shadow-sm"
                          : "border-slate-200/80 hover:border-slate-300 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="text-xs font-extrabold text-[#0b2545] flex items-center gap-1">
                          <span>{item.originIata}</span>
                          <span aria-hidden="true" className="text-[#0096c7]">
                            →
                          </span>
                          <span className="sr-only">a</span>
                          <span>{item.destinationIata}</span>
                        </div>
                        <span className="text-xs font-extrabold text-[#0b2545]">
                          {displayPrice} €
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600 truncate mt-1">
                        {getCityName(item.destinationIata)} ·{" "}
                        {formatShortDate(item.startDate)} –{" "}
                        {formatShortDate(item.endDate)}
                      </div>

                      <div className="mt-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${pill.classes}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`w-1.5 h-1.5 rounded-full ${pill.dot}`}
                          />
                          {pill.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Vista detallada de la alerta seleccionada */}
              {selectedAlert && (
                <AlertCard alert={selectedAlert} onRefresh={loadData} />
              )}
            </>
          )}
        </div>
      </main>

      {/* Widget del Chat de Agente IA (minimizado por defecto en esquina inferior derecha) */}
      <AgentChatbot onAlertCreated={loadData} />

      {/* Notificación flotante verde (en escritorio abajo a la izquierda; en móvil arriba de la barra del chat) */}
      {featuredTriggeredAlert && !dismissToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 left-4 right-4 sm:right-auto sm:bottom-5 sm:left-5 z-40 sm:max-w-sm bg-[#e7f8ef] border border-emerald-300/90 rounded-2xl px-4 py-3 shadow-xl flex items-center gap-3"
        >
          <span
            aria-hidden="true"
            className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0"
          >
            ✓
          </span>
          <button
            type="button"
            onClick={() => setSelectedAlertId(featuredTriggeredAlert.id)}
            className="text-left cursor-pointer pr-2 flex-1"
          >
            <div className="text-xs font-extrabold text-emerald-900">
              ¡Vuelo encontrado desde{" "}
              {getBestPriceForAlert(featuredTriggeredAlert)} €!
            </div>
            <div className="text-[11px] font-medium text-emerald-700">
              {getCityName(featuredTriggeredAlert.originIata)} →{" "}
              {getCityName(featuredTriggeredAlert.destinationIata)}
            </div>
          </button>
          <button
            type="button"
            aria-label="Cerrar aviso de vuelo encontrado"
            onClick={() => setDismissToast(true)}
            className="text-emerald-700/70 hover:text-emerald-950 text-xs font-bold ml-auto p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Modal accesible para vincular Telegram Chat ID */}
      {showTelegramModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="telegram-modal-title"
          className="fixed inset-0 z-50 bg-[#0b2545]/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl">
            <h3
              id="telegram-modal-title"
              className="text-base font-extrabold text-[#0b2545] flex items-center gap-2"
            >
              <span aria-hidden="true">📲</span> Configurar Avisos en Telegram
            </h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Recibe al instante las bajadas de precio con aerolínea, escalas,
              hora de salida y enlace directo a la reserva:
            </p>
            <ol className="text-xs text-slate-700 mt-3 space-y-1.5 list-decimal list-inside bg-[#f4f7fb] p-3.5 rounded-2xl border border-slate-200/80">
              <li>
                Abre tu bot en Telegram y pulsa{" "}
                <strong>Iniciar (/start)</strong>.
              </li>
              <li>
                Introduce abajo tu <strong>Chat ID numérico</strong> (ej.{" "}
                <code className="text-[#0077b6] font-semibold">1418929473</code>
                ).
              </li>
            </ol>

            <form onSubmit={handleSaveTelegram} className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor="telegram-chat-id-input"
                  className="block text-xs font-semibold text-[#0b2545] mb-1"
                >
                  Tu Telegram Chat ID
                </label>
                <input
                  id="telegram-chat-id-input"
                  type="text"
                  required
                  autoFocus
                  value={telegramInput}
                  onChange={(e) => setTelegramInput(e.target.value)}
                  placeholder="Ej: 1418929473"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8fafc] border border-slate-200 text-xs text-[#0b2545] focus:outline-none focus:border-[#0096c7]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTelegramModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingTelegram}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#0e3968] to-[#00a8e8] text-xs font-semibold text-white cursor-pointer"
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
