"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  api,
  AlertStatus,
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
  const [statusFilter, setStatusFilter] = useState<"ALL" | AlertStatus>("ALL");
  const [directFilter, setDirectFilter] = useState<"ALL" | "DIRECT" | "LAYOVER">("ALL");
  const [mobileVisibleCount, setMobileVisibleCount] = useState<number>(3);
  const [isMobileView, setIsMobileView] = useState<boolean>(false);
  const [dismissToast, setDismissToast] = useState(false);
  const [cronPromptedIds, setCronPromptedIds] = useState<Record<string, boolean>>({});
  const seenTriggeredIdsRef = useRef<Set<string>>(new Set());

  // Modal de configuración de Telegram
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramInput, setTelegramInput] = useState("");
  const [savingTelegram, setSavingTelegram] = useState(false);

  const searchesSectionRef = useRef<HTMLDivElement>(null);

  const handleKeepTriggeredAlert = useCallback((alertId: string) => {
    seenTriggeredIdsRef.current.delete(alertId);
    setCronPromptedIds((prev) => {
      const next = { ...prev };
      delete next[alertId];
      return next;
    });
  }, []);

  const loadData = useCallback(async (selectLatest = false) => {
    try {
      const [profileData, alertsData] = await Promise.all([
        api.auth.getProfile(),
        api.alerts.list(),
      ]);
      setUser(profileData);
      setTelegramInput(profileData.telegramChatId || "");
      setAlerts(alertsData);
      for (const a of alertsData) {
        if (a.status === "TRIGGERED") {
          seenTriggeredIdsRef.current.add(a.id);
        } else {
          seenTriggeredIdsRef.current.delete(a.id);
        }
      }
      setSelectedAlertId((prev) => {
        if (selectLatest) return alertsData[0]?.id || null;
        if (prev && alertsData.some((a) => a.id === prev)) return prev;
        return alertsData[0]?.id || null;
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAlertCreated = useCallback(() => {
    loadData(true);
  }, [loadData]);

  const hasInitialSearchingAlerts = alerts.some((a) =>
    Boolean(a.isInitialSearching)
  );

  useEffect(() => {
    if (!hasInitialSearchingAlerts) return;
    const fastInterval = setInterval(() => {
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
    }, 1500);
    return () => clearInterval(fastInterval);
  }, [hasInitialSearchingAlerts]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (!localStorage.getItem("flight_jwt_token")) return;
      api.alerts
        .list()
        .then((data) => {
          setAlerts(data);
          setCronPromptedIds((prev) => {
            const next = { ...prev };
            for (const a of data) {
              if (a.status === "TRIGGERED") {
                if (seenTriggeredIdsRef.current.has(a.id) || a.pendingCompletionPrompt) {
                  next[a.id] = true;
                }
                seenTriggeredIdsRef.current.add(a.id);
              } else {
                seenTriggeredIdsRef.current.delete(a.id);
                delete next[a.id];
              }
            }
            return next;
          });
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
    const checkViewport = () => {
      setIsMobileView(window.innerWidth < 640);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  useEffect(() => {
    setMobileVisibleCount(3);
  }, [statusFilter, directFilter, navTab]);

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
  const pausedCount = alerts.filter((a) => a.status === "PAUSED").length;
  const completedCount = alerts.filter((a) => a.status === "COMPLETED").length;
  const activeOrTriggeredCount = alerts.filter(
    (a) => a.status === "ACTIVE" || a.status === "TRIGGERED"
  ).length;

  const latestAlert = alerts[0] || null;

  const filteredAlerts = alerts.filter((a) => {
    if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
    if (directFilter === "DIRECT" && !a.directOnly) return false;
    if (directFilter === "LAYOVER" && a.directOnly) return false;
    return true;
  });

  const selectedAlert =
    filteredAlerts.find((a) => a.id === selectedAlertId) ||
    filteredAlerts[0] ||
    null;

  const featuredTriggeredAlert =
    alerts.find((a) => a.status === "TRIGGERED" && !a.isInitialSearching) || null;

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f7fb] text-[#0b2545]">
      {/* Barra superior blanca (Navbar estilo V Flights, responsiva en móvil y escritorio) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-0 sm:h-20 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Logo V Flights */}
            <div className="flex items-center">
              <img
                src="/logo.jpg"
                alt="Logo de V Flights"
                className="h-12 sm:h-15 w-auto object-contain"
              />
            </div>

            {/* Pestañas de navegación principales destacadas */}
            <nav
              aria-label="Navegación principal del panel"
              className="hidden md:flex items-center gap-1.5 p-1.5 rounded-full bg-[#eef4fa] border border-sky-200/80 shadow-inner"
            >
              <button
                type="button"
                aria-current={navTab === "comparador" ? "page" : undefined}
                onClick={() => setNavTab("comparador")}
                className={`px-5 py-2.5 rounded-full text-sm lg:text-[15px] font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  navTab === "comparador"
                    ? "bg-gradient-to-r from-[#0b2545] via-[#0e3968] to-[#0077b6] text-white shadow-md shadow-[#0b2545]/25 ring-1 ring-cyan-300/30"
                    : "text-[#0b2545] bg-white/80 hover:bg-white hover:text-[#0077b6] shadow-2xs"
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
                className={`px-5 py-2.5 rounded-full text-sm lg:text-[15px] font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  navTab === "alertas"
                    ? "bg-gradient-to-r from-[#0b2545] via-[#0e3968] to-[#0077b6] text-white shadow-md shadow-[#0b2545]/25 ring-1 ring-cyan-300/30"
                    : "text-[#0b2545] bg-white/80 hover:bg-white hover:text-[#0077b6] shadow-2xs"
                }`}
              >
                <span aria-hidden="true">🔔</span>
                <span>Mis alertas</span>
                <span
                  className={`px-2 py-0.5 rounded-full font-extrabold text-xs leading-none ${
                    navTab === "alertas"
                      ? "bg-[#18c1f0] text-[#07223b]"
                      : "bg-[#0e3968] text-white"
                  }`}
                >
                  {activeOrTriggeredCount}
                </span>
              </button>
            </nav>
          </div>

          {/* Derecha: Estado de alertas activas + Telegram + Salir */}
          <div className="flex items-center gap-2">
            <div className="hidden lg:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-sm font-semibold text-[#0b2545] shadow-2xs">
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
              className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold border flex items-center gap-1.5 transition cursor-pointer ${
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
              className="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-slate-100 hover:bg-rose-50 text-xs sm:text-sm font-semibold text-slate-700 hover:text-rose-600 transition cursor-pointer"
            >
              Salir
            </button>
          </div>

          {/* Barra de pestañas visible en móvil (<768px) */}
          <nav
            aria-label="Navegación móvil"
            className="flex md:hidden w-full items-center gap-1.5 p-1.5 mt-1 rounded-full bg-[#eef4fa] border border-sky-200/80 shadow-inner"
          >
            <button
              type="button"
              aria-current={navTab === "comparador" ? "page" : undefined}
              onClick={() => setNavTab("comparador")}
              className={`flex-1 justify-center px-3.5 py-2 rounded-full text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                navTab === "comparador"
                  ? "bg-gradient-to-r from-[#0b2545] via-[#0e3968] to-[#0077b6] text-white shadow-sm"
                  : "bg-white/80 text-[#0b2545]"
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
              className={`flex-1 justify-center px-3.5 py-2 rounded-full text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                navTab === "alertas"
                  ? "bg-gradient-to-r from-[#0b2545] via-[#0e3968] to-[#0077b6] text-white shadow-sm"
                  : "bg-white/80 text-[#0b2545]"
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
            <CreateAlertForm onAlertCreated={handleAlertCreated} />
          </div>
        </section>
      )}

      {/* Contenido Principal según la pestaña activa ("comparador" vs "alertas") */}
      <main
        id="main-content"
        ref={searchesSectionRef}
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-32"
      >
        {navTab === "comparador" ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-extrabold text-[#0b2545] tracking-tight">
                  Última búsqueda
                </h2>
                <p className="text-xs text-slate-500">
                  Detalle en tiempo real de la última alerta creada
                </p>
              </div>
              {alerts.length > 1 && (
                <button
                  type="button"
                  onClick={() => setNavTab("alertas")}
                  className="px-3.5 py-1.5 rounded-full bg-white hover:bg-sky-50 border border-slate-200 hover:border-cyan-300 text-xs font-semibold text-[#0077b6] transition cursor-pointer shadow-2xs"
                >
                  Ver todas en Mis alertas ({alerts.length}) →
                </button>
              )}
            </div>

            {!latestAlert ? (
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
              <AlertCard
                alert={latestAlert}
                onRefresh={loadData}
                showCompletionPrompt={Boolean(
                  latestAlert.pendingCompletionPrompt ||
                    cronPromptedIds[latestAlert.id]
                )}
                onKeepAlert={handleKeepTriggeredAlert}
              />
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-[#0b2545] tracking-tight">
                  Mis alertas
                </h2>
                <p className="text-xs text-slate-500">
                  Consulta todas tus alertas y fíltralas por tipo de alerta o escalas
                </p>
              </div>
              <span className="text-xs font-medium text-slate-500">
                Mostrando {filteredAlerts.length} de {alerts.length} alertas
              </span>
            </div>

            {/* Barra de filtros por tipo/estado de alerta y tipo de vuelo */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-2xs">
              <div
                role="group"
                aria-label="Filtrar por tipo de alerta"
                className="flex flex-wrap items-center gap-1.5"
              >
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                    statusFilter === "ALL"
                      ? "bg-[#0e2a47] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                  }`}
                >
                  Todas ({alerts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("TRIGGERED")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    statusFilter === "TRIGGERED"
                      ? "bg-emerald-600 text-white"
                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`w-1.5 h-1.5 rounded-full ${
                      statusFilter === "TRIGGERED" ? "bg-white" : "bg-emerald-500"
                    }`}
                  />
                  <span>Vuelo encontrado ({foundCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("ACTIVE")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    statusFilter === "ACTIVE"
                      ? "bg-blue-600 text-white"
                      : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/80"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`w-1.5 h-1.5 rounded-full ${
                      statusFilter === "ACTIVE" ? "bg-white" : "bg-blue-500"
                    }`}
                  />
                  <span>Buscando ({searchingCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("PAUSED")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    statusFilter === "PAUSED"
                      ? "bg-amber-600 text-white"
                      : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/80"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`w-1.5 h-1.5 rounded-full ${
                      statusFilter === "PAUSED" ? "bg-white" : "bg-amber-500"
                    }`}
                  />
                  <span>En pausa ({pausedCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("COMPLETED")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    statusFilter === "COMPLETED"
                      ? "bg-amber-700 text-white"
                      : "bg-amber-50/80 text-amber-800 hover:bg-amber-100 border border-amber-300"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`w-1.5 h-1.5 rounded-full ${
                      statusFilter === "COMPLETED" ? "bg-white" : "bg-amber-500"
                    }`}
                  />
                  <span>Completadas ({completedCount})</span>
                </button>
              </div>

              <div
                role="group"
                aria-label="Filtrar por tipo de vuelo"
                className="inline-flex items-center rounded-xl bg-slate-100 p-1 self-start lg:self-auto"
              >
                <button
                  type="button"
                  onClick={() => setDirectFilter("ALL")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                    directFilter === "ALL"
                      ? "bg-white text-[#0b2545] shadow-2xs"
                      : "text-slate-600 hover:text-[#0b2545]"
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setDirectFilter("DIRECT")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                    directFilter === "DIRECT"
                      ? "bg-white text-[#0b2545] shadow-2xs"
                      : "text-slate-600 hover:text-[#0b2545]"
                  }`}
                >
                  ✈️ Solo directo
                </button>
                <button
                  type="button"
                  onClick={() => setDirectFilter("LAYOVER")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                    directFilter === "LAYOVER"
                      ? "bg-white text-[#0b2545] shadow-2xs"
                      : "text-slate-600 hover:text-[#0b2545]"
                  }`}
                >
                  🔄 Con escalas
                </button>
              </div>
            </div>

            {filteredAlerts.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-12 text-center shadow-xs">
                <div aria-hidden="true" className="text-3xl mb-2">
                  🔔
                </div>
                <h3 className="text-base font-bold text-[#0b2545]">
                  No hay alertas que coincidan con el filtro seleccionado
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                  Cambia el filtro superior para ver el resto de tus alertas.
                </p>
              </div>
            ) : (
              <>
                {/* Fila de mini-tarjetas seleccionables (en móvil: máx. 3 visibles y paginación por scroll) */}
                <div
                  role="group"
                  aria-label="Lista de tus alertas de vuelo"
                  onScroll={(e) => {
                    if (!isMobileView) return;
                    const el = e.currentTarget;
                    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
                      setMobileVisibleCount((prev) =>
                        Math.min(prev + 3, filteredAlerts.length)
                      );
                    }
                  }}
                  className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 max-h-[318px] overflow-y-auto snap-y snap-mandatory pr-1 sm:max-h-none sm:overflow-visible sm:pr-0"
                >
                  {(isMobileView
                    ? filteredAlerts.slice(0, mobileVisibleCount)
                    : filteredAlerts
                  ).map((item) => {
                    const isSelected = selectedAlert?.id === item.id;
                    const isCompleted = item.status === "COMPLETED";
                    const pill = STATUS_PILLS[item.status] || STATUS_PILLS.ACTIVE;
                    const displayPrice = getBestPriceForAlert(item);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedAlertId(item.id)}
                        className={`snap-start text-left rounded-2xl p-4 transition-all cursor-pointer border ${
                          isCompleted
                            ? isSelected
                              ? "bg-gradient-to-br from-amber-50 via-yellow-50/80 to-amber-100/70 border-amber-400 ring-2 ring-amber-400/30 shadow-sm"
                              : "bg-gradient-to-br from-amber-50/90 via-yellow-50/60 to-amber-100/50 border-amber-300/90 hover:border-amber-400 shadow-2xs"
                            : isSelected
                            ? "bg-white border-[#2596d4] ring-2 ring-[#2596d4]/15 shadow-sm"
                            : "bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="text-xs font-extrabold text-[#0b2545] flex items-center gap-1 truncate">
                            <span>{getCityName(item.originIata)}</span>
                            <span aria-hidden="true" className="text-[#0096c7]">
                              →
                            </span>
                            <span className="sr-only">a</span>
                            <span>{getCityName(item.destinationIata)}</span>
                          </div>
                          <span className="text-xs font-extrabold text-[#0b2545] shrink-0">
                            {item.isInitialSearching
                              ? "…"
                              : displayPrice !== null
                              ? `${displayPrice} €`
                              : "Sin límite"}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-600 truncate mt-1">
                          <span className="font-mono text-[10px] text-slate-500">
                            {item.originIata}–{item.destinationIata}
                          </span>{" "}
                          · {formatShortDate(item.startDate)} –{" "}
                          {formatShortDate(item.endDate)}
                        </div>

                        <div className="mt-2.5 flex items-center justify-between gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${pill.classes}`}
                          >
                            {item.isInitialSearching ? (
                              <span
                                aria-hidden="true"
                                className="w-2.5 h-2.5 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin"
                              />
                            ) : (
                              <span
                                aria-hidden="true"
                                className={`w-1.5 h-1.5 rounded-full ${pill.dot}`}
                              />
                            )}
                            {item.isInitialSearching ? "Buscando chollos..." : pill.label}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500">
                            {item.directOnly ? "✈️ Directo" : "🔄 Escalas"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {isMobileView && filteredAlerts.length > 3 && (
                  <p className="text-[11px] text-slate-500 text-center sm:hidden">
                    Desliza hacia abajo en la lista para ver más alertas (
                    {Math.min(mobileVisibleCount, filteredAlerts.length)} de{" "}
                    {filteredAlerts.length})
                  </p>
                )}

                {/* Vista detallada de la alerta seleccionada */}
                {selectedAlert && (
                  <AlertCard
                    alert={selectedAlert}
                    onRefresh={loadData}
                    collapsibleDates
                    showCompletionPrompt={Boolean(
                      selectedAlert.pendingCompletionPrompt ||
                        cronPromptedIds[selectedAlert.id]
                    )}
                    onKeepAlert={handleKeepTriggeredAlert}
                  />
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Widget del Chat de Agente IA (minimizado por defecto en esquina inferior derecha) */}
      <AgentChatbot onAlertCreated={handleAlertCreated} />

      {/* Notificación flotante (en escritorio abajo a la izquierda; en móvil arriba de la barra del chat) */}
      {featuredTriggeredAlert && !dismissToast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-24 left-4 right-4 sm:right-auto sm:bottom-5 sm:left-5 z-40 sm:max-w-md rounded-2xl px-4 py-3 shadow-xl border ${
            featuredTriggeredAlert.pendingCompletionPrompt ||
            cronPromptedIds[featuredTriggeredAlert.id]
              ? "bg-amber-50 border-amber-300"
              : "bg-[#e7f8ef] border-emerald-300/90"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                featuredTriggeredAlert.pendingCompletionPrompt ||
                cronPromptedIds[featuredTriggeredAlert.id]
                  ? "bg-amber-400/25 text-amber-800"
                  : "bg-emerald-500/20 text-emerald-700"
              }`}
            >
              {featuredTriggeredAlert.pendingCompletionPrompt ||
              cronPromptedIds[featuredTriggeredAlert.id]
                ? "⏰"
                : "✓"}
            </span>
            <button
              type="button"
              onClick={() => setSelectedAlertId(featuredTriggeredAlert.id)}
              className="text-left cursor-pointer pr-2 flex-1"
            >
              <div className="text-xs font-extrabold text-[#0b2545]">
                {(() => {
                  const toastPrice = getBestPriceForAlert(featuredTriggeredAlert);
                  return toastPrice !== null
                    ? `¡Vuelo encontrado desde ${toastPrice} €!`
                    : "¡Vuelo encontrado!";
                })()}{" "}
                ({getCityName(featuredTriggeredAlert.originIata)} →{" "}
                {getCityName(featuredTriggeredAlert.destinationIata)})
              </div>
              <div className="text-[11px] font-medium text-slate-600 mt-0.5">
                {featuredTriggeredAlert.pendingCompletionPrompt ||
                cronPromptedIds[featuredTriggeredAlert.id]
                  ? "Sigue sin completarse tras la revisión periódica. ¿Quieres completarla o mantenerla?"
                  : "Pulsa para ver las fechas encontradas"}
              </div>
            </button>
            <button
              type="button"
              aria-label="Cerrar aviso de vuelo encontrado"
              onClick={() => setDismissToast(true)}
              className="text-slate-500 hover:text-slate-800 text-xs font-bold ml-auto p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>

          {(featuredTriggeredAlert.pendingCompletionPrompt ||
            cronPromptedIds[featuredTriggeredAlert.id]) && (
            <div className="mt-2.5 pt-2.5 border-t border-amber-200/80 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={async () => {
                  await api.alerts.updateStatus(
                    featuredTriggeredAlert.id,
                    "COMPLETED"
                  );
                  handleKeepTriggeredAlert(featuredTriggeredAlert.id);
                  loadData();
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold cursor-pointer transition"
              >
                📥 Completar
              </button>
              <button
                type="button"
                onClick={async () => {
                  handleKeepTriggeredAlert(featuredTriggeredAlert.id);
                  await api.alerts.updateStatus(
                    featuredTriggeredAlert.id,
                    "ACTIVE"
                  );
                  loadData();
                }}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-sky-50 border border-slate-200 text-[#0b2545] text-xs font-semibold cursor-pointer transition"
              >
                🧭 Mantener
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal accesible para vincular Telegram Chat ID con guía paso a paso */}
      {showTelegramModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="telegram-modal-title"
          className="fixed inset-0 z-50 bg-[#0b2545]/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl my-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="telegram-modal-title"
                  className="text-base sm:text-lg font-extrabold text-[#0b2545] flex items-center gap-2"
                >
                  <span aria-hidden="true">📲</span> Vincular alertas con Telegram
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Recibe al instante las bajadas de precio con aerolínea, escalas,
                  hora de salida y enlace directo a la reserva.
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar ventana de configuración de Telegram"
                onClick={() => setShowTelegramModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold transition cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Guía paso a paso sobre cómo obtener el Chat ID de Telegram */}
            <div className="mt-4 bg-[#f4f7fb] p-4 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0b2545]">
                  🧭 Guía paso a paso: ¿Cómo obtener tu ID de Telegram?
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-sky-100 text-[#0077b6] font-bold text-[10px]">
                  Tarda 30 seg
                </span>
              </div>

              <ol className="space-y-2.5 text-xs text-slate-700">
                <li className="flex items-start gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200/70">
                  <span
                    aria-hidden="true"
                    className="w-5 h-5 rounded-full bg-[#0e2a47] text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5"
                  >
                    1
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#0b2545]">
                      Averigua tu número de Chat ID con @userinfobot
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Abre Telegram, busca{" "}
                      <a
                        href="https://t.me/userinfobot"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-[#0077b6] underline hover:text-[#0b2545]"
                      >
                        @userinfobot ↗
                      </a>{" "}
                      y pulsa <strong>Iniciar</strong> (o envíale{" "}
                      <code className="px-1.5 py-0.5 rounded bg-slate-100 text-[#0b2545] font-mono">
                        /start
                      </code>
                      ).
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200/70">
                  <span
                    aria-hidden="true"
                    className="w-5 h-5 rounded-full bg-[#0e2a47] text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5"
                  >
                    2
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#0b2545]">
                      Copia el número que aparece junto a «Id:»
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      El bot te responderá con tus datos. Copia únicamente el número de{" "}
                      <strong>Id</strong> (es distinto de tu alias{" "}
                      <code className="text-slate-500">@usuario</code>):
                    </p>
                    <div className="mt-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] flex items-center justify-between">
                      <span>
                        Id:{" "}
                        <strong className="text-cyan-300">1418929473</strong>
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans">
                        ← Copia este número
                      </span>
                    </div>
                  </div>
                </li>

                <li className="flex items-start gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200/70">
                  <span
                    aria-hidden="true"
                    className="w-5 h-5 rounded-full bg-[#0e2a47] text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5"
                  >
                    3
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#0b2545]">
                      Inicia el bot de alertas y pega tu ID abajo
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Abre{" "}
                      <a
                        href="https://t.me/asistente_comparador_vuelos_bot"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-[#0077b6] underline hover:text-[#0b2545]"
                      >
                        @asistente_comparador_vuelos_bot ↗
                      </a>{" "}
                      y pulsa <strong>Iniciar</strong> (o envíale{" "}
                      <code className="px-1.5 py-0.5 rounded bg-slate-100 text-[#0b2545] font-mono">
                        /start
                      </code>
                      ) para darle permiso de enviarte mensajes, pega tu ID
                      numérico abajo y guarda.
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <form onSubmit={handleSaveTelegram} className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor="telegram-chat-id-input"
                  className="block text-xs font-bold text-[#0b2545] mb-1"
                >
                  Tu Telegram Chat ID (solo números)
                </label>
                <input
                  id="telegram-chat-id-input"
                  type="text"
                  inputMode="numeric"
                  pattern="^-?[0-9]+$"
                  required
                  autoFocus
                  value={telegramInput}
                  onChange={(e) => setTelegramInput(e.target.value)}
                  placeholder="Ej: 1418929473"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8fafc] border border-slate-200 text-xs font-semibold text-[#0b2545] placeholder-slate-400 placeholder:font-normal focus:outline-none focus:border-[#0096c7]"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  💡 Recuerda introducir el número de ID (ej.{" "}
                  <code className="font-mono text-slate-700">1418929473</code>),
                  no tu nombre de usuario con <code className="font-mono">@</code>.
                </p>
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
