"use client";

import React, { useState } from "react";
import { api, FlightAlert, AlertStatus, WEEKDAYS, AIRPORTS_CATALOG } from "@/lib/api";

interface AlertCardProps {
  alert: FlightAlert;
  onRefresh: () => void;
}

const STATUS_BADGES: Record<
  AlertStatus,
  { label: string; classes: string; dot: string }
> = {
  ACTIVE: {
    label: "Activa · Monitorizando",
    classes: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    dot: "bg-sky-400 animate-pulse",
  },
  TRIGGERED: {
    label: "¡Chollo Encontrado! 🔔",
    classes: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
    dot: "bg-emerald-400",
  },
  PAUSED: {
    label: "En Pausa",
    classes: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    dot: "bg-amber-400",
  },
  COMPLETED: {
    label: "Completada / Expirada",
    classes: "bg-slate-800 text-slate-400 border-slate-700",
    dot: "bg-slate-500",
  },
};

export function AlertCard({ alert, onRefresh }: AlertCardProps) {
  const [busy, setBusy] = useState(false);
  const [showMatches, setShowMatches] = useState(alert.status === "TRIGGERED");

  const getDayLabel = (day: number) =>
    WEEKDAYS.find((d) => d.value === day)?.label || `Día ${day}`;

  const getCityName = (iata: string) =>
    AIRPORTS_CATALOG.find((a) => a.iata === iata)?.city || iata;

  const badge = STATUS_BADGES[alert.status] || STATUS_BADGES.ACTIVE;

  const handleStatusChange = async (newStatus: AlertStatus) => {
    setBusy(true);
    try {
      await api.alerts.updateStatus(alert.id, newStatus);
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleManualCheck = async () => {
    setBusy(true);
    try {
      await api.alerts.triggerCheck(alert.id);
      setTimeout(() => onRefresh(), 1500);
    } finally {
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

  const formatDate = (iso: string) => iso.split("T")[0];

  return (
    <div
      className={`rounded-2xl border p-5 transition-all ${
        alert.status === "TRIGGERED"
          ? "bg-slate-900/90 border-emerald-500/40 shadow-lg shadow-emerald-500/5"
          : "bg-slate-900/60 border-slate-800/90 hover:border-slate-700"
      }`}
    >
      {/* Cabecera de la tarjeta */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-bold text-white tracking-tight">
              {getCityName(alert.originIata)}{" "}
              <span className="font-mono text-xs text-sky-400">
                ({alert.originIata})
              </span>
            </span>
            <span className="text-slate-500">➔</span>
            <span className="text-lg font-bold text-white tracking-tight">
              {getCityName(alert.destinationIata)}{" "}
              <span className="font-mono text-xs text-sky-400">
                ({alert.destinationIata})
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1.5">
            <span>
              📅 Ida: <strong className="text-slate-200">{getDayLabel(alert.departureDay)}</strong> · Vuelta:{" "}
              <strong className="text-slate-200">{getDayLabel(alert.returnDay)}</strong>
            </span>
            <span>
              👥 <strong className="text-slate-200">{alert.adults ?? 1}</strong>{" "}
              {(alert.adults ?? 1) === 1 ? "pasajero" : "pasajeros"}
            </span>
            <span>
              🗓️ {formatDate(alert.startDate)} al {formatDate(alert.endDate)}
            </span>
          </div>
        </div>

        {/* Presupuesto y Badge de Estado */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
              Umbral Máx.
            </span>
            <span className="text-base font-bold text-white">
              {Number(alert.maxPriceEur)} €
            </span>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${badge.classes}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
            {badge.label}
          </span>
        </div>
      </div>

      {/* Barra de acciones e historial de Matches */}
      <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMatches(!showMatches)}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-xs font-medium text-slate-200 transition cursor-pointer"
          >
            {showMatches ? "▾ Ocultar" : "▸ Ver"} chollos detectados (
            {alert.matches?.length || 0})
          </button>

          {alert.status === "ACTIVE" && (
            <button
              type="button"
              disabled={busy}
              onClick={handleManualCheck}
              className="px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-xs font-medium text-sky-300 transition cursor-pointer disabled:opacity-40"
            >
              🔍 Comprobar ahora
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {alert.status !== "ACTIVE" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleStatusChange("ACTIVE")}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-medium transition cursor-pointer"
            >
              ▶ Reactivar
            </button>
          )}

          {alert.status === "ACTIVE" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleStatusChange("PAUSED")}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-medium transition cursor-pointer"
            >
              ⏸ Pausar
            </button>
          )}

          {alert.status !== "COMPLETED" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleStatusChange("COMPLETED")}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
            >
              ✓ Ya compré el vuelo
            </button>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={handleDelete}
            className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium transition cursor-pointer"
          >
            🗑 Eliminar
          </button>
        </div>
      </div>

      {/* Lista desplegable de Matches encontrados */}
      {showMatches && (
        <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-2">
          {!alert.matches || alert.matches.length === 0 ? (
            <div className="text-xs text-slate-500 py-2 text-center">
              Aún no se han registrado vuelos por debajo de {Number(alert.maxPriceEur)} € para esta alerta.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {alert.matches.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">
                      📅 {formatDate(m.departureDate)} ➔ {formatDate(m.returnDate)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      🏢 Aerolínea:{" "}
                      <span className="text-slate-200 font-medium">
                        {m.airlineCode || "Varios"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-bold text-emerald-400">
                      {Number(m.foundPriceEur)} €
                    </span>
                    {m.bookingUrl && (
                      <a
                        href={m.bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-[11px] transition"
                      >
                        Reservar ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
