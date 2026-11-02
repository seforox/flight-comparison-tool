"use client";

import React, { useState } from "react";
import { api, WEEKDAYS } from "@/lib/api";
import { AirportSelector } from "./AirportSelector";

interface CreateAlertFormProps {
  onAlertCreated: () => void;
}

export function CreateAlertForm({ onAlertCreated }: CreateAlertFormProps) {
  const [originIata, setOriginIata] = useState("MAD");
  const [destinationIata, setDestinationIata] = useState("LON");
  const [departureDay, setDepartureDay] = useState(1);
  const [returnDay, setReturnDay] = useState(3);
  const [adults, setAdults] = useState(1);
  const [maxPriceEur, setMaxPriceEur] = useState(100);
  const [startDate, setStartDate] = useState("2026-11-01");
  const [endDate, setEndDate] = useState("2026-11-30");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      await api.alerts.create({
        originIata,
        destinationIata,
        departureDay: Number(departureDay),
        returnDay: Number(returnDay),
        adults: Number(adults),
        maxPriceEur: Number(maxPriceEur),
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      });
      setSuccess(true);
      onAlertCreated();
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || "Error al crear la alerta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-950/60 border border-slate-800/90 rounded-2xl p-5 space-y-4"
    >
      <div className="border-b border-slate-800 pb-3">
        <h3 className="text-sm font-semibold text-white">
          Configuración Manual por Patrón Semanal
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          El motor buscará todas las semanas que cumplan tus días dentro del rango elegido
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
          🚀 ¡Alerta creada y encolada en BullMQ! Recibirás un Telegram si hay ofertas.
        </div>
      )}

      <div className="space-y-3.5">
        <AirportSelector
          label="Aeropuerto de Origen"
          value={originIata}
          onChange={setOriginIata}
        />

        <AirportSelector
          label="Aeropuerto de Destino"
          value={destinationIata}
          onChange={setDestinationIata}
        />

        {/* Días de la semana */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Día de Salida
            </label>
            <select
              value={departureDay}
              onChange={(e) => setDepartureDay(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              {WEEKDAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Día de Regreso
            </label>
            <select
              value={returnDay}
              onChange={(e) => setReturnDay(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              {WEEKDAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Pasajeros y Presupuesto */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Pasajeros (Adultos)
            </label>
            <select
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <option key={num} value={num}>
                  {num} {num === 1 ? "pasajero" : "pasajeros"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Presupuesto Máx. (€)
            </label>
            <input
              type="number"
              min={1}
              step="1"
              required
              value={maxPriceEur}
              onChange={(e) => setMaxPriceEur(Number(e.target.value))}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Rango de fechas */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Desde fecha
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Hasta fecha
            </label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-sky-500/20 transition disabled:opacity-50 cursor-pointer"
      >
        {loading ? "Creando y buscando vuelos..." : "⚡ Crear Alerta y Buscar Ahora"}
      </button>
    </form>
  );
}
