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
  const [departureDay, setDepartureDay] = useState(5); // Viernes
  const [returnDay, setReturnDay] = useState(7); // Domingo
  const [startDate, setStartDate] = useState("2026-11-01");
  const [endDate, setEndDate] = useState("2026-11-30");
  const [adults, setAdults] = useState(1);
  const [maxPriceEur, setMaxPriceEur] = useState<string>("100");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSwapAirports = () => {
    const temp = originIata;
    setOriginIata(destinationIata || "MAD");
    setDestinationIata(temp);
  };

  const applyRangePreset = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinationIata) {
      setError("Por favor, elige un aeropuerto de destino.");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setError("La fecha de inicio no puede ser posterior a la fecha de fin.");
      return;
    }
    const parsedBudget = Number(maxPriceEur);
    if (!parsedBudget || parsedBudget <= 0) {
      setError("Introduce un precio objetivo válido en euros (mayor que 0).");
      return;
    }

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
        maxPriceEur: parsedBudget,
        startDate: new Date(`${startDate}T00:00:00.000Z`).toISOString(),
        endDate: new Date(`${endDate}T23:59:59.999Z`).toISOString(),
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

  const depLabel =
    WEEKDAYS.find((d) => d.value === departureDay)?.label || "Viernes";
  const retLabel =
    WEEKDAYS.find((d) => d.value === returnDay)?.label || "Domingo";

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Buscador de alertas de vuelos por días de la semana"
      className="bg-white rounded-3xl shadow-[0_18px_45px_rgba(11,37,69,0.12)] border border-slate-200/80 p-4 sm:p-7 space-y-5"
    >
      {/* Fila 1: ORIGEN ⇄ DESTINO */}
      <div className="flex flex-col md:flex-row items-stretch md:items-end gap-3">
        <AirportSelector
          label="ORIGEN"
          value={originIata}
          onChange={setOriginIata}
          placeholder="Elige aeropuerto de origen"
        />

        <div className="flex items-center justify-center md:pb-0.5">
          <button
            type="button"
            onClick={handleSwapAirports}
            aria-label="Intercambiar aeropuerto de origen y destino"
            title="Intercambiar origen y destino"
            className="w-9 h-9 rounded-full bg-white border border-slate-200 hover:border-cyan-400 hover:bg-cyan-50/40 text-slate-600 hover:text-[#0b2545] flex items-center justify-center shadow-2xs transition cursor-pointer"
          >
            <span aria-hidden="true">⇄</span>
          </button>
        </div>

        <AirportSelector
          label="DESTINO"
          value={destinationIata}
          onChange={setDestinationIata}
          placeholder="Elige aeropuerto de destino"
        />
      </div>

      {/* Fila 2: DÍA DE SALIDA | DÍA DE REGRESO | DESDE FECHA | HASTA FECHA | PASAJEROS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
        <div className="lg:col-span-3">
          <label
            htmlFor="field-departure-day"
            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
          >
            DÍA DE SALIDA
          </label>
          <select
            id="field-departure-day"
            value={departureDay}
            onChange={(e) => setDepartureDay(Number(e.target.value))}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8fafc] border border-slate-200 hover:border-slate-300 text-sm font-medium text-[#0b2545] focus:outline-none focus:border-[#0096c7] cursor-pointer"
          >
            {WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value}>
                Cada {d.label}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-3">
          <label
            htmlFor="field-return-day"
            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
          >
            DÍA DE REGRESO
          </label>
          <select
            id="field-return-day"
            value={returnDay}
            onChange={(e) => setReturnDay(Number(e.target.value))}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8fafc] border border-slate-200 hover:border-slate-300 text-sm font-medium text-[#0b2545] focus:outline-none focus:border-[#0096c7] cursor-pointer"
          >
            {WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value}>
                Cada {d.label}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label
            htmlFor="field-start-date"
            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
          >
            DESDE FECHA
          </label>
          <input
            id="field-start-date"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-[#f8fafc] border border-slate-200 hover:border-slate-300 text-xs sm:text-sm font-medium text-[#0b2545] focus:outline-none focus:border-[#0096c7]"
          />
        </div>

        <div className="lg:col-span-2">
          <label
            htmlFor="field-end-date"
            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
          >
            HASTA FECHA
          </label>
          <input
            id="field-end-date"
            type="date"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-[#f8fafc] border border-slate-200 hover:border-slate-300 text-xs sm:text-sm font-medium text-[#0b2545] focus:outline-none focus:border-[#0096c7]"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-2">
          <label
            htmlFor="field-adults"
            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
          >
            PASAJEROS
          </label>
          <select
            id="field-adults"
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8fafc] border border-slate-200 hover:border-slate-300 text-sm font-medium text-[#0b2545] focus:outline-none focus:border-[#0096c7] cursor-pointer"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <option key={num} value={num}>
                {num} {num === 1 ? "adulto" : "adultos"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Fila 3: Presupuesto objetivo + Atajos de rango + Botón principal */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-4 pt-1">
        <div className="flex flex-wrap items-center justify-between sm:justify-start gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <label
              htmlFor="field-max-price"
              className="text-xs font-semibold text-[#0b2545]"
            >
              Precio objetivo máx.
            </label>
            <div className="relative flex items-center">
              <input
                id="field-max-price"
                type="number"
                min={1}
                step="1"
                required
                value={maxPriceEur}
                onChange={(e) => setMaxPriceEur(e.target.value)}
                placeholder="100"
                className="w-28 pl-3 pr-7 py-2 rounded-xl bg-[#f8fafc] border border-slate-200 text-xs font-bold text-[#0b2545] placeholder-slate-400 focus:outline-none focus:border-[#0096c7]"
              />
              <span
                aria-hidden="true"
                className="absolute right-2.5 text-xs text-slate-500 font-semibold"
              >
                €
              </span>
            </div>
          </div>

          {/* Píldoras rápidas de rango */}
          <div
            role="group"
            aria-label="Atajos rápidos de fechas"
            className="flex flex-wrap items-center gap-1.5 text-[11px]"
          >
            <span className="text-slate-500 mr-1 hidden md:inline">
              Rango rápido:
            </span>
            <button
              type="button"
              onClick={() => applyRangePreset("2026-11-01", "2026-11-15")}
              className="px-2.5 py-1 rounded-full bg-[#f4f7fb] hover:bg-sky-50 border border-slate-200 text-slate-600 hover:text-[#0b2545] transition cursor-pointer"
            >
              1–15 nov
            </button>
            <button
              type="button"
              onClick={() => applyRangePreset("2026-11-01", "2026-11-30")}
              className="px-2.5 py-1 rounded-full bg-[#f4f7fb] hover:bg-sky-50 border border-slate-200 text-slate-600 hover:text-[#0b2545] transition cursor-pointer"
            >
              Noviembre
            </button>
            <button
              type="button"
              onClick={() => applyRangePreset("2026-12-01", "2026-12-31")}
              className="px-2.5 py-1 rounded-full bg-[#f4f7fb] hover:bg-sky-50 border border-slate-200 text-slate-600 hover:text-[#0b2545] transition cursor-pointer"
            >
              Diciembre
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto justify-center px-6 py-3 rounded-full bg-gradient-to-r from-[#0e3968] via-[#06689f] to-[#00b4d8] hover:from-[#0b2d52] hover:to-[#0096c7] text-white font-semibold text-sm shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
        >
          <svg
            aria-hidden="true"
            className="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.2}
              d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <span>
            {loading
              ? "Buscando vuelos..."
              : `Buscar vuelos (${depLabel} a ${retLabel})`}
          </span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium"
        >
          <span aria-hidden="true">⚠️ </span>
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          aria-live="polite"
          className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium"
        >
          <span aria-hidden="true">✓ </span>
          Alerta creada para todos los {depLabel} ➔ {retLabel} del rango
          seleccionado.
        </div>
      )}
    </form>
  );
}
