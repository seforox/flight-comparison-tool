"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  api,
  FlightAlert,
  FlightMatch,
  AlertStatus,
  WEEKDAYS,
  getCachedAirport,
  addDaysToIsoDate,
  validateAlertSearchParams,
} from "@/lib/api";
import { AirportSelector } from "./AirportSelector";

interface AlertCardProps {
  alert: FlightAlert;
  onRefresh: () => void | Promise<void>;
  collapsibleDates?: boolean;
  showCompletionPrompt?: boolean;
  onKeepAlert?: (alertId: string) => void;
}

export const STATUS_PILLS: Record<
  AlertStatus,
  { label: string; classes: string; dot: string }
> = {
  TRIGGERED: {
    label: "Vuelo encontrado",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  ACTIVE: {
    label: "Buscando",
    classes: "bg-blue-50 text-blue-600 border-blue-200",
    dot: "bg-blue-500 animate-pulse",
  },
  COMPLETED: {
    label: "Completada",
    classes: "bg-amber-100 text-amber-800 border-amber-300",
    dot: "bg-amber-500",
  },
  PAUSED: {
    label: "En pausa",
    classes: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
};

const SHORT_MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.split("T")[0];
  return `${d.getUTCDate()} ${SHORT_MONTHS[d.getUTCMonth()]}`;
}

function formatNextSearchTimeframe(
  intervalLabel?: string,
  nextSearchAt?: string | null
): string {
  const baseInterval = intervalLabel || "cada 6 horas";
  if (!nextSearchAt) return baseInterval;

  const target = new Date(nextSearchAt);
  if (isNaN(target.getTime())) return baseInterval;

  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) return baseInterval;

  const totalMinutes = Math.ceil(diffMs / 60000);
  let relativeLabel: string;
  if (totalMinutes <= 1) {
    relativeLabel = "en menos de 1 minuto";
  } else if (totalMinutes < 60) {
    relativeLabel = `en ${totalMinutes} min`;
  } else {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    relativeLabel =
      mins > 0 ? `en ${hours} h ${mins} min` : `en ${hours} ${hours === 1 ? "hora" : "horas"}`;
  }

  const timeStr = target.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${baseInterval} (próxima búsqueda ${relativeLabel}, a las ${timeStr})`;
}

function generateAlertDateTuples(
  startDateIso: string,
  endDateIso: string,
  departureDay: number,
  returnDay: number
): Array<{ departureDate: Date; returnDate: Date; depKey: string }> {
  const tuples: Array<{ departureDate: Date; returnDate: Date; depKey: string }> =
    [];

  const current = new Date(startDateIso);
  current.setUTCHours(0, 0, 0, 0);

  const end = new Date(endDateIso);
  end.setUTCHours(23, 59, 59, 999);

  if (isNaN(current.getTime()) || isNaN(end.getTime())) return tuples;

  while (current <= end && tuples.length < 12) {
    const jsDay = current.getUTCDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;

    if (isoDay === departureDay) {
      const returnDate = new Date(current);
      let daysToAdd = returnDay - departureDay;
      if (daysToAdd <= 0) {
        daysToAdd += 7;
      }
      returnDate.setUTCDate(returnDate.getUTCDate() + daysToAdd);

      if (returnDate <= end) {
        const depCopy = new Date(current);
        tuples.push({
          departureDate: depCopy,
          returnDate,
          depKey: depCopy.toISOString().split("T")[0],
        });
      }
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return tuples;
}

export function getBestPriceForAlert(alert: FlightAlert): number {
  if (alert.matches && alert.matches.length > 0) {
    return Math.min(...alert.matches.map((m) => Number(m.foundPriceEur)));
  }
  return Number(alert.maxPriceEur);
}

export function AlertCard({
  alert,
  onRefresh,
  collapsibleDates = false,
  showCompletionPrompt = false,
  onKeepAlert,
}: AlertCardProps) {
  const [busy, setBusy] = useState(false);
  const [waitingSearchStart, setWaitingSearchStart] = useState(false);
  const [selectedTupleIdx, setSelectedTupleIdx] = useState(0);
  const [resolvedCities, setResolvedCities] = useState<Record<string, string>>({});
  const [showDates, setShowDates] = useState(!collapsibleDates);

  // Estado de edición de la alerta
  const [isEditing, setIsEditing] = useState(false);
  const [editOriginIata, setEditOriginIata] = useState(alert.originIata);
  const [editDestinationIata, setEditDestinationIata] = useState(alert.destinationIata);
  const [editDepartureDay, setEditDepartureDay] = useState(alert.departureDay);
  const [editReturnDay, setEditReturnDay] = useState(alert.returnDay);
  const [editStartDate, setEditStartDate] = useState(alert.startDate.split("T")[0]);
  const [editEndDate, setEditEndDate] = useState(alert.endDate.split("T")[0]);
  const [editAdults, setEditAdults] = useState(alert.adults ?? 1);
  const [editDirectOnly, setEditDirectOnly] = useState(Boolean(alert.directOnly));
  const [editMaxPriceEur, setEditMaxPriceEur] = useState(String(Number(alert.maxPriceEur)));
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    setIsEditing(false);
    setShowDates(!collapsibleDates);
    setEditOriginIata(alert.originIata);
    setEditDestinationIata(alert.destinationIata);
    setEditDepartureDay(alert.departureDay);
    setEditReturnDay(alert.returnDay);
    setEditStartDate(alert.startDate.split("T")[0]);
    setEditEndDate(alert.endDate.split("T")[0]);
    setEditAdults(alert.adults ?? 1);
    setEditDirectOnly(Boolean(alert.directOnly));
    setEditMaxPriceEur(String(Number(alert.maxPriceEur)));
    setEditError(null);
  }, [alert.id, collapsibleDates]);

  useEffect(() => {
    let active = true;
    for (const code of [alert.originIata, alert.destinationIata]) {
      if (!code || getCachedAirport(code)) continue;
      api.airports.getByIata(code).then((found) => {
        if (active && found) {
          setResolvedCities((prev) => ({ ...prev, [code.toUpperCase()]: found.city }));
        }
      });
    }
    return () => {
      active = false;
    };
  }, [alert.originIata, alert.destinationIata]);

  const getCityName = (iata: string) =>
    getCachedAirport(iata)?.city || resolvedCities[iata?.toUpperCase()] || iata;

  const getDayLabel = (day: number) =>
    WEEKDAYS.find((d) => d.value === day)?.label || `Día ${day}`;

  const getDayShort = (day: number) =>
    WEEKDAYS.find((d) => d.value === day)?.short || `D${day}`;

  const pill = STATUS_PILLS[alert.status] || STATUS_PILLS.ACTIVE;

  const bestPrice = useMemo(() => {
    if (alert.matches && alert.matches.length > 0) {
      return Math.min(...alert.matches.map((m) => Number(m.foundPriceEur)));
    }
    return null;
  }, [alert.matches]);

  const dateTuples = useMemo(() => {
    const rawTuples = generateAlertDateTuples(
      alert.startDate,
      alert.endDate,
      alert.departureDay,
      alert.returnDay
    );

    const matchesByDepDate = new Map<string, FlightMatch>();
    for (const m of alert.matches || []) {
      const key = m.departureDate.split("T")[0];
      const existing = matchesByDepDate.get(key);
      if (!existing || Number(m.foundPriceEur) < Number(existing.foundPriceEur)) {
        matchesByDepDate.set(key, m);
      }
    }

    return rawTuples.map((t) => {
      const match = matchesByDepDate.get(t.depKey) || null;
      const depShort = `${getDayShort(alert.departureDay)} ${formatShortDate(
        t.departureDate.toISOString()
      )}`;
      const retShort = `${getDayShort(alert.returnDay)} ${formatShortDate(
        t.returnDate.toISOString()
      )}`;

      return {
        depKey: t.depKey,
        rangeLabel: `${formatShortDate(
          t.departureDate.toISOString()
        )} – ${formatShortDate(t.returnDate.toISOString())}`,
        fullPatternLabel: `${depShort} → ${retShort}`,
        subBarLabel: `${t.departureDate.getUTCDate()}–${t.returnDate.getUTCDate()} ${
          SHORT_MONTHS[t.departureDate.getUTCMonth()]
        }`,
        match,
        price: match ? Number(match.foundPriceEur) : null,
      };
    });
  }, [alert]);

  const activeTuple =
    dateTuples[Math.min(selectedTupleIdx, Math.max(0, dateTuples.length - 1))] ||
    null;

  const targetPrice = Number(alert.maxPriceEur);
  const matchedDatesCount = useMemo(() => {
    const fromTuples = dateTuples.filter((t) => t.match !== null).length;
    if (fromTuples > 0) return fromTuples;
    return alert.matches?.length ?? 0;
  }, [dateTuples, alert.matches]);
  const maxChartValue = useMemo(() => {
    const prices = dateTuples
      .map((t) => t.price ?? targetPrice)
      .concat([targetPrice]);
    return Math.max(...prices, 1);
  }, [dateTuples, targetPrice]);

  const handleStatusChange = async (newStatus: AlertStatus) => {
    setBusy(true);
    if (newStatus === "ACTIVE") {
      setWaitingSearchStart(true);
    }
    try {
      await api.alerts.updateStatus(alert.id, newStatus);
      if (newStatus === "COMPLETED") {
        setIsEditing(false);
      }
      await onRefresh();
    } finally {
      setWaitingSearchStart(false);
      setBusy(false);
    }
  };

  const handleManualCheck = async () => {
    setBusy(true);
    setWaitingSearchStart(true);
    try {
      await api.alerts.triggerCheck(alert.id);
      await onRefresh();
    } finally {
      setWaitingSearchStart(false);
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await api.alerts.remove(alert.id);
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleOpenEdit = () => {
    setEditOriginIata(alert.originIata);
    setEditDestinationIata(alert.destinationIata);
    setEditDepartureDay(alert.departureDay);
    setEditReturnDay(alert.returnDay);
    setEditStartDate(alert.startDate.split("T")[0]);
    setEditEndDate(alert.endDate.split("T")[0]);
    setEditAdults(alert.adults ?? 1);
    setEditDirectOnly(Boolean(alert.directOnly));
    setEditMaxPriceEur(String(Number(alert.maxPriceEur)));
    setEditError(null);
    setIsEditing(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOriginIata || !editDestinationIata) {
      setEditError("Por favor, selecciona un aeropuerto de origen y destino.");
      return;
    }
    if (!editStartDate || !editEndDate) {
      setEditError("Por favor, selecciona el rango de fechas (desde y hasta).");
      return;
    }
    const validationError = validateAlertSearchParams({
      originIata: editOriginIata,
      destinationIata: editDestinationIata,
      departureDay: Number(editDepartureDay),
      returnDay: Number(editReturnDay),
      startDate: editStartDate,
      endDate: editEndDate,
    });
    if (validationError) {
      setEditError(validationError);
      return;
    }
    const parsedPrice = Number(editMaxPriceEur);
    if (!parsedPrice || parsedPrice <= 0) {
      setEditError("Introduce un presupuesto máximo válido mayor que 0 €.");
      return;
    }

    setEditError(null);
    setBusy(true);
    setWaitingSearchStart(true);
    try {
      await api.alerts.update(alert.id, {
        originIata: editOriginIata,
        destinationIata: editDestinationIata,
        departureDay: Number(editDepartureDay),
        returnDay: Number(editReturnDay),
        adults: Number(editAdults),
        directOnly: editDirectOnly,
        maxPriceEur: parsedPrice,
        startDate: new Date(`${editStartDate}T00:00:00.000Z`).toISOString(),
        endDate: new Date(`${editEndDate}T23:59:59.999Z`).toISOString(),
      });
      setIsEditing(false);
      await onRefresh();
    } catch (err: any) {
      setEditError(err.message || "Error al modificar la alerta");
    } finally {
      setWaitingSearchStart(false);
      setBusy(false);
    }
  };

  const isCompleted = alert.status === "COMPLETED";
  const isInitialSearching = Boolean(alert.isInitialSearching) || waitingSearchStart;
  const nextSearchPhrase = formatNextSearchTimeframe(
    alert.nextSearchScheduleLabel,
    alert.nextSearchAt
  );

  if (isInitialSearching) {
    return (
      <section
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={`Buscando vuelos para ${getCityName(alert.originIata)} a ${getCityName(
          alert.destinationIata
        )}`}
        className="bg-white rounded-3xl border border-sky-200/80 p-6 sm:p-10 shadow-[0_10px_30px_rgba(11,37,69,0.05)]"
      >
        <div className="flex flex-col items-center text-center max-w-md mx-auto py-4">
          <div className="relative flex items-center justify-center w-16 h-16 mb-5">
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full border-4 border-sky-100"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#0096c7] border-r-[#00b4d8] animate-spin"
            />
            <span aria-hidden="true" className="text-xl">
              ✈️
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-extrabold text-[#0b2545] tracking-tight">
            Buscando los mejores chollos para tus vuelos
          </h3>

          <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
            Estamos recuperando toda la información para{" "}
            <strong className="text-[#0b2545]">
              {getCityName(alert.originIata)} → {getCityName(alert.destinationIata)}
            </strong>{" "}
            ({getDayLabel(alert.departureDay)} ➔ {getDayLabel(alert.returnDay)}). En
            cuanto termine la búsqueda mostraremos los resultados.
          </p>

          <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-[#0077b6]">
            <span className="px-3 py-1 rounded-full bg-sky-50 border border-sky-200/70 font-mono">
              {alert.originIata} – {alert.destinationIata}
            </span>
            <span className="px-3 py-1 rounded-full bg-sky-50 border border-sky-200/70">
              {formatShortDate(alert.startDate)} – {formatShortDate(alert.endDate)}
            </span>
            <span className="px-3 py-1 rounded-full bg-sky-50 border border-sky-200/70">
              {alert.directOnly ? "✈️ Solo directo" : "🔄 Con escalas"}
            </span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label={`Detalle de la alerta ${getCityName(alert.originIata)} a ${getCityName(
        alert.destinationIata
      )}`}
      className="space-y-4"
    >
      {/* Tarjeta principal de detalle de la ruta seleccionada */}
      <div
        onClick={(e) => {
          if (!collapsibleDates) return;
          const target = e.target as HTMLElement;
          if (target.closest("button, a, form, input, select, label")) return;
          setShowDates((prev) => !prev);
        }}
        className={`rounded-3xl border p-4 sm:p-6 transition-colors ${
          collapsibleDates ? "cursor-pointer" : ""
        } ${
          isCompleted
            ? "bg-gradient-to-br from-amber-50/95 via-yellow-50/75 to-amber-100/60 border-amber-300 shadow-[0_12px_32px_rgba(217,119,6,0.12)]"
            : "bg-white border-slate-200/80 shadow-[0_10px_30px_rgba(11,37,69,0.04)] hover:border-cyan-300/80"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0">
            {/* Píldoras superiores */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${pill.classes}`}
              >
                <span aria-hidden="true" className={`w-2 h-2 rounded-full ${pill.dot}`} />
                {pill.label}
              </span>
              <span className="px-3 py-1 rounded-full bg-sky-50 text-[#0077b6] border border-sky-200/70 text-xs font-semibold">
                <span aria-hidden="true">📅 </span>
                {getDayLabel(alert.departureDay)} ➔{" "}
                {getDayLabel(alert.returnDay)}
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-100 text-[#0b2545] border border-slate-200 text-xs font-semibold">
                <span aria-hidden="true">{alert.directOnly ? "✈️ " : "🔄 "}</span>
                {alert.directOnly ? "Solo directo" : "Con escalas"}
              </span>
            </div>

            {/* Título grande: Madrid -> Londres */}
            <h3 className="text-xl sm:text-3xl font-extrabold text-[#0b2545] tracking-tight flex flex-wrap items-center gap-2">
              <span>{getCityName(alert.originIata)}</span>
              <span aria-hidden="true" className="text-[#0096c7] font-normal">
                →
              </span>
              <span className="sr-only">a</span>
              <span>{getCityName(alert.destinationIata)}</span>
            </h3>

            {/* Subtítulo técnico */}
            <p className="text-xs sm:text-sm text-slate-600 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono font-semibold text-slate-700">
                {alert.originIata} – {alert.destinationIata}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {formatShortDate(alert.startDate)} –{" "}
                {formatShortDate(alert.endDate)}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <span aria-hidden="true">👥 </span>
                {alert.adults ?? 1}{" "}
                {(alert.adults ?? 1) === 1 ? "pasajero" : "pasajeros"}
              </span>
              <span aria-hidden="true">·</span>
              <span>{dateTuples.length} fechas monitorizadas</span>
            </p>
          </div>

          {/* Cajas de MEJOR PRECIO y OBJETIVO (responsivas en móvil: 2 columnas iguales) */}
          <div className="grid grid-cols-2 sm:flex items-center gap-2.5 sm:gap-3 w-full md:w-auto shrink-0">
            <div className="bg-[#f4f7fb] border border-slate-200/60 rounded-2xl px-4 py-3 text-right sm:min-w-[125px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                MEJOR PRECIO
              </span>
              <span className="text-lg sm:text-2xl font-extrabold text-[#0b2545] mt-0.5 block">
                {bestPrice !== null ? `${bestPrice} €` : "— €"}
              </span>
            </div>

            <div className="bg-[#eff8ff] border border-cyan-200/60 rounded-2xl px-4 py-3 text-right sm:min-w-[125px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                OBJETIVO MÁX.
              </span>
              <span className="text-lg sm:text-2xl font-extrabold text-[#0096c7] mt-0.5 block">
                {targetPrice} €
              </span>
            </div>
          </div>
        </div>

        {/* Aviso positivo cuando la alerta está en TRIGGERED (al menos un vuelo encontrado) */}
        {alert.status === "TRIGGERED" &&
          !(alert.pendingCompletionPrompt || showCompletionPrompt) && (
            <div
              role="status"
              className="mt-4 p-3.5 sm:p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200/90 flex items-start gap-2.5"
            >
              <span
                aria-hidden="true"
                className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-300/80 text-emerald-700 flex items-center justify-center text-sm font-bold shrink-0"
              >
                ✓
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[#0b2545]">
                  ¡Vuelo encontrado!{" "}
                  {matchedDatesCount > 0 && (
                    <span>
                      Hemos encontrado {matchedDatesCount}{" "}
                      {matchedDatesCount === 1 ? "vuelo" : "vuelos"} por debajo de{" "}
                      {targetPrice} €
                      {bestPrice !== null ? ` (desde ${bestPrice} €)` : ""}.
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                  Revisa las fechas destacadas abajo para reservar o marca la alerta como completada si ya no necesitas seguir monitorizándola.
                </p>
              </div>
            </div>
          )}

        {/* Aviso cuando el cron vuelve a pasar y la alerta sigue en TRIGGERED (Vuelo encontrado) sin completarse */}
        {alert.status === "TRIGGERED" &&
          (alert.pendingCompletionPrompt || showCompletionPrompt) && (
            <div
              role="alert"
              className="mt-4 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-yellow-50/90 to-emerald-50/70 border border-amber-300/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="w-7 h-7 rounded-xl bg-amber-400/25 border border-amber-300 flex items-center justify-center text-sm shrink-0"
                >
                  ⏰
                </span>
                <div>
                  <p className="text-xs font-extrabold text-[#0b2545]">
                    Esta alerta ya tiene vuelos encontrados y sigue sin marcarse como completada
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Ha vuelto a pasar el ciclo de revisión automática. ¿Quieres darla por completada o mantener la búsqueda activa?
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleStatusChange("COMPLETED")}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <span aria-hidden="true">📥</span>
                  <span>Completar alerta</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onKeepAlert?.(alert.id);
                    handleStatusChange("ACTIVE");
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-sky-50 border border-slate-200 hover:border-cyan-300 text-[#0b2545] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <span aria-hidden="true">🧭</span>
                  <span>Mantener</span>
                </button>
              </div>
            </div>
          )}

        {/* Aviso con plazo de próxima búsqueda automática cuando no se han encontrado vuelos todavía */}
        {alert.status === "ACTIVE" &&
          (!alert.matches || alert.matches.length === 0) && (
            <div
              role="status"
              className="mt-4 p-3.5 sm:p-4 rounded-2xl bg-sky-50/80 border border-sky-200/80 flex items-start gap-2.5"
            >
              <span
                aria-hidden="true"
                className="w-7 h-7 rounded-xl bg-sky-100 border border-sky-200 flex items-center justify-center text-sm shrink-0"
              >
                🕒
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[#0b2545]">
                  No se han encontrado vuelos por debajo de {targetPrice} € por ahora
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                  Volveremos a lanzar la búsqueda automáticamente{" "}
                  <strong className="text-[#0077b6]">{nextSearchPhrase}</strong>.
                  Si encontramos un chollo te avisaremos al instante.
                </p>
              </div>
            </div>
          )}

        {/* Barra de botones de acción */}
        <div
          role="group"
          aria-label="Acciones de la alerta"
          className={`mt-5 pt-4 border-t flex flex-wrap items-center gap-2 ${
            isCompleted ? "border-amber-200/80" : "border-slate-100"
          }`}
        >
          {isCompleted ? (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-100/80 border border-amber-300 text-xs font-bold text-amber-900">
              <span aria-hidden="true">🏆</span>
              <span>Alerta completada y archivada</span>
            </span>
          ) : (
            <>
              <button
                type="button"
                disabled={busy || alert.status === "ACTIVE"}
                onClick={() => handleStatusChange("ACTIVE")}
                className="px-3.5 py-2 rounded-xl bg-[#f4f7fb] hover:bg-blue-50 border border-slate-200/80 hover:border-blue-200 text-xs font-semibold text-[#0b2545] hover:text-blue-700 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
              >
                <span aria-hidden="true">🧭</span>
                <span>Seguir buscando</span>
              </button>

              {alert.status === "ACTIVE" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleStatusChange("PAUSED")}
                  className="px-3.5 py-2 rounded-xl bg-[#f4f7fb] hover:bg-amber-50 border border-slate-200/80 hover:border-amber-200 text-xs font-semibold text-[#0b2545] hover:text-amber-700 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
                >
                  <span aria-hidden="true">⏸</span>
                  <span>Pausar</span>
                </button>
              )}

              <button
                type="button"
                disabled={busy}
                onClick={() => handleStatusChange("COMPLETED")}
                className="px-3.5 py-2 rounded-xl bg-[#f4f7fb] hover:bg-amber-50 border border-slate-200/80 hover:border-amber-300 text-xs font-semibold text-[#0b2545] hover:text-amber-800 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
              >
                <span aria-hidden="true">📥</span>
                <span>Completar</span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => (isEditing ? setIsEditing(false) : handleOpenEdit())}
                className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 ${
                  isEditing
                    ? "bg-[#0b2545] text-white border-[#0b2545]"
                    : "bg-[#f4f7fb] hover:bg-cyan-50 border-slate-200/80 hover:border-cyan-300 text-[#0b2545] hover:text-[#0077b6]"
                }`}
              >
                <span aria-hidden="true">✏️</span>
                <span>{isEditing ? "Cerrar edición" : "Modificar"}</span>
              </button>
            </>
          )}

          {collapsibleDates && (
            <button
              type="button"
              onClick={() => setShowDates((prev) => !prev)}
              aria-expanded={showDates}
              className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                showDates
                  ? "bg-[#0e2a47] text-white border-[#0e2a47]"
                  : "bg-sky-50 hover:bg-sky-100 border-sky-200 text-[#0077b6]"
              }`}
            >
              <span aria-hidden="true">📅</span>
              <span>
                {showDates
                  ? "Ocultar fechas"
                  : `Desplegar fechas (${dateTuples.length})`}
              </span>
              <span aria-hidden="true" className="text-[10px]">
                {showDates ? "▴" : "▾"}
              </span>
            </button>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={handleDelete}
            aria-label={`Eliminar alerta de ${getCityName(alert.originIata)} a ${getCityName(
              alert.destinationIata
            )}`}
            className="px-3 py-2 rounded-xl hover:bg-rose-50 text-xs font-semibold text-rose-600 flex items-center gap-1 transition cursor-pointer sm:ml-auto"
          >
            <span aria-hidden="true">🗑</span>
            <span>Eliminar</span>
          </button>
        </div>

        {/* Formulario desplegable para modificar los datos de la alerta */}
        {isEditing && !isCompleted && (
          <form
            onSubmit={handleSaveEdit}
            noValidate
            aria-label="Formulario para modificar los datos de la alerta"
            className="mt-5 pt-5 border-t border-slate-200/80 space-y-4 bg-[#f8fafc] p-4 sm:p-5 rounded-2xl border"
          >
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0b2545]">
                ✏️ Modificar parámetros de la alerta
              </h4>
              <span className="text-[11px] text-slate-500">
                Al guardar se volverán a buscar vuelos con los nuevos datos
              </span>
            </div>

            {/* Origen y Destino */}
            <div className="flex flex-col md:flex-row items-stretch md:items-end gap-3">
              <AirportSelector
                label="ORIGEN"
                value={editOriginIata}
                onChange={setEditOriginIata}
                placeholder="Elige aeropuerto de origen"
                disabledIata={editDestinationIata}
                disabledReason="Ya seleccionado en destino"
              />
              <div className="flex items-center justify-center md:pb-0.5">
                <button
                  type="button"
                  onClick={() => {
                    const tmp = editOriginIata;
                    setEditOriginIata(editDestinationIata);
                    setEditDestinationIata(tmp);
                  }}
                  aria-label="Intercambiar origen y destino"
                  className="w-9 h-9 rounded-full bg-white border border-slate-200 hover:border-cyan-400 text-slate-600 hover:text-[#0b2545] flex items-center justify-center shadow-2xs transition cursor-pointer"
                >
                  <span aria-hidden="true">⇄</span>
                </button>
              </div>
              <AirportSelector
                label="DESTINO"
                value={editDestinationIata}
                onChange={setEditDestinationIata}
                placeholder="Elige aeropuerto de destino"
                disabledIata={editOriginIata}
                disabledReason="Ya seleccionado en origen"
              />
            </div>

            {/* Días, Fechas y Pasajeros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  DÍA DE SALIDA
                </label>
                <select
                  value={editDepartureDay}
                  onChange={(e) => setEditDepartureDay(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-[#0b2545] focus:outline-none focus:border-[#0096c7]"
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  DÍA DE REGRESO
                </label>
                <select
                  value={editReturnDay}
                  onChange={(e) => setEditReturnDay(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-[#0b2545] focus:outline-none focus:border-[#0096c7]"
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-3">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  DESDE FECHA
                </label>
                <input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-[#0b2545] focus:outline-none focus:border-[#0096c7]"
                />
              </div>

              <div className="lg:col-span-3">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  HASTA FECHA
                </label>
                <input
                  type="date"
                  min={editStartDate ? addDaysToIsoDate(editStartDate, 1) : undefined}
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-[#0b2545] focus:outline-none focus:border-[#0096c7]"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  PASAJEROS
                </label>
                <select
                  value={editAdults}
                  onChange={(e) => setEditAdults(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-[#0b2545] focus:outline-none focus:border-[#0096c7]"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "adulto" : "adultos"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tipo de vuelo, Presupuesto máximo y Botones de acción */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-xl bg-white border border-slate-200 p-1">
                  <button
                    type="button"
                    onClick={() => setEditDirectOnly(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                      editDirectOnly
                        ? "bg-[#0b2545] text-white"
                        : "text-slate-600 hover:text-[#0b2545]"
                    }`}
                  >
                    <span aria-hidden="true">✈️</span>
                    <span>Solo directo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditDirectOnly(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                      !editDirectOnly
                        ? "bg-[#0b2545] text-white"
                        : "text-slate-600 hover:text-[#0b2545]"
                    }`}
                  >
                    <span aria-hidden="true">🔄</span>
                    <span>Con escalas</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    OBJETIVO MÁX. (€)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      step="1"
                      value={editMaxPriceEur}
                      onChange={(e) => setEditMaxPriceEur(e.target.value)}
                      className="w-28 pl-3 pr-7 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-[#0b2545] focus:outline-none focus:border-[#0096c7]"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                      €
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#0e3968] to-[#00a8e8] hover:opacity-95 text-white text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {busy ? "Guardando..." : "Guardar y buscar"}
                </button>
              </div>
            </div>

            {editError && (
              <div
                role="alert"
                className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium"
              >
                {editError}
              </div>
            )}
          </form>
        )}
      </div>

      {/* Contenido desplegable con las combinaciones de fechas y gráfica comparativa */}
      {showDates && (
        <>
          {/* Tarjetas de las combinaciones de fechas generadas por (departureDay -> returnDay) */}
          {dateTuples.length > 0 && (
        <div
          role="group"
          aria-label="Combinaciones de fechas dentro del rango"
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
        >
          {dateTuples.map((tuple, idx) => {
            const isSelected = idx === selectedTupleIdx;
            const hasDeal = tuple.price !== null;
            return (
              <button
                key={tuple.depKey}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedTupleIdx(idx)}
                className={`relative text-left rounded-3xl p-4 sm:p-5 transition-all cursor-pointer border ${
                  isSelected
                    ? "bg-[#0e2a47] border-[#0e2a47] text-white shadow-lg shadow-[#0e2a47]/15"
                    : "bg-white border-slate-200/80 hover:border-cyan-400 text-[#0b2545] shadow-xs"
                }`}
              >
                {hasDeal && !isSelected && (
                  <span
                    aria-hidden="true"
                    className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-[#00b4d8] ring-4 ring-cyan-100"
                  />
                )}
                <span
                  className={`text-sm font-bold block ${
                    isSelected ? "text-white" : "text-[#0b2545]"
                  }`}
                >
                  {tuple.fullPatternLabel}
                </span>

                <span
                  className={`text-[11px] block mt-3 ${
                    isSelected ? "text-sky-200/80" : "text-slate-500"
                  }`}
                >
                  {hasDeal ? "vuelo encontrado" : "objetivo máx."}
                </span>
                <span
                  className={`text-xl font-extrabold block ${
                    isSelected
                      ? "text-[#18c1f0]"
                      : hasDeal
                      ? "text-emerald-600"
                      : "text-slate-500"
                  }`}
                >
                  {hasDeal ? `${tuple.price} €` : `≤ ${targetPrice} €`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Gráfica comparativa por fechas para el patrón elegido + Enlaces de reserva */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-6 shadow-[0_10px_30px_rgba(11,37,69,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
          <div>
            <h4 className="text-base font-bold text-[#0b2545]">
              Comparativa de precios ({getDayLabel(alert.departureDay)} →{" "}
              {getDayLabel(alert.returnDay)})
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Evolución de tarifas según los días seleccionados dentro de tu rango
            </p>
          </div>
          <span className="text-xs font-semibold text-[#0077b6] bg-sky-50 px-3 py-1 rounded-full border border-sky-200/60">
            Umbral objetivo: {targetPrice} €
          </span>
        </div>

        {dateTuples.length === 0 ? (
          <div className="text-xs text-slate-500 py-8 text-center">
            El rango de fechas seleccionado no contiene ninguna combinación de{" "}
            {getDayLabel(alert.departureDay)} a {getDayLabel(alert.returnDay)}.
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div
              role="group"
              aria-label="Gráfica de barras de precios por fecha"
              className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4 items-end min-h-44 pt-4 px-1"
            >
              {dateTuples.map((tuple, idx) => {
                const hasDeal = tuple.price !== null;
                const val = tuple.price ?? targetPrice;
                const heightPct = Math.max(
                  35,
                  Math.round((val / maxChartValue) * 100)
                );
                const isSelected = idx === selectedTupleIdx;

                return (
                  <button
                    key={tuple.depKey}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${tuple.fullPatternLabel}: ${
                      hasDeal
                        ? `vuelo encontrado por ${tuple.price} euros`
                        : `sin oferta por debajo de ${targetPrice} euros`
                    }`}
                    onClick={() => setSelectedTupleIdx(idx)}
                    className="flex flex-col items-center justify-end h-full group cursor-pointer p-1 rounded-xl"
                  >
                    <div className="w-full flex justify-center items-end h-32">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-9 sm:w-11 rounded-t-xl rounded-b-md transition-all ${
                          hasDeal
                            ? isSelected
                              ? "bg-gradient-to-b from-[#00b4d8] to-[#0077b6] shadow-md shadow-cyan-500/30 ring-2 ring-[#0e2a47]/20"
                              : "bg-gradient-to-b from-[#38bdf8] to-[#0284c7] opacity-90 group-hover:opacity-100"
                            : "bg-slate-200 border border-dashed border-slate-300"
                        }`}
                      />
                    </div>
                    <span
                      className={`text-xs font-extrabold mt-2.5 ${
                        hasDeal ? "text-[#0077b6]" : "text-slate-500"
                      }`}
                    >
                      {hasDeal ? `${tuple.price}€` : `>${targetPrice}€`}
                    </span>
                    <span className="text-[10px] font-bold uppercase text-[#0b2545] mt-0.5">
                      {tuple.subBarLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Detalle de la combinación seleccionada */}
        {activeTuple && activeTuple.match && (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="p-4 rounded-2xl bg-[#f0f9ff] border border-cyan-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6] block">
                  OPCIÓN SELECCIONADA
                </span>
                <div className="text-sm font-extrabold text-[#0b2545] mt-0.5">
                  <span aria-hidden="true">🛫 </span>
                  {activeTuple.fullPatternLabel} ·{" "}
                  <span className="text-[#0077b6]">
                    {activeTuple.match.airlineCode || "Vuelo directo"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3">
                <span className="text-lg font-extrabold text-emerald-700">
                  {Number(activeTuple.match.foundPriceEur)} €
                </span>
                {activeTuple.match.bookingUrl && (
                  <a
                    href={activeTuple.match.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-full bg-gradient-to-r from-[#0e3968] to-[#00a8e8] hover:opacity-95 text-white font-semibold text-xs shadow-sm transition"
                  >
                    Reservar vuelo <span aria-hidden="true">↗</span>
                    <span className="sr-only"> (se abre en una pestaña nueva)</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {(!alert.matches || alert.matches.length === 0) && (
          <div className="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
            <span>
              Aún no se han detectado vuelos por debajo de {targetPrice} € en
              las fechas de este rango.
              {alert.status === "ACTIVE" && (
                <>
                  {" "}
                  Se volverá a buscar automáticamente{" "}
                  <strong className="text-[#0077b6]">{nextSearchPhrase}</strong>.
                </>
              )}
            </span>
            <button
              type="button"
              onClick={handleManualCheck}
              className="text-[#0077b6] font-semibold hover:underline cursor-pointer"
            >
              Comprobar ahora →
            </button>
          </div>
        )}
      </div>
      </>
      )}
    </section>
  );
}
