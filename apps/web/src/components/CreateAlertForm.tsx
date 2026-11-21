"use client";

import React, { useState } from "react";
import {
  api,
  WEEKDAYS,
  addDaysToIsoDate,
  validateAlertSearchParams,
} from "@/lib/api";
import { AirportSelector } from "./AirportSelector";

interface CreateAlertFormProps {
  onAlertCreated: () => void;
}

export function CreateAlertForm({ onAlertCreated }: CreateAlertFormProps) {
  const [originIata, setOriginIata] = useState("");
  const [destinationIata, setDestinationIata] = useState("");
  const [departureDay, setDepartureDay] = useState<string>("");
  const [returnDay, setReturnDay] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [adults, setAdults] = useState<string>("");
  const [directOnly, setDirectOnly] = useState<boolean | null>(null);
  const [maxPriceEur, setMaxPriceEur] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetForm = () => {
    setOriginIata("");
    setDestinationIata("");
    setDepartureDay("");
    setReturnDay("");
    setStartDate("");
    setEndDate("");
    setAdults("");
    setDirectOnly(null);
    setMaxPriceEur("");
  };

  const handleSwapAirports = () => {
    const temp = originIata;
    setOriginIata(destinationIata);
    setDestinationIata(temp);
  };

  const applyRangePreset = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  };

  const quickRangePresets = React.useMemo(() => {
    const monthsFull = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    const monthsShort = [
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

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonthIdx = now.getMonth(); // 0..11
    const curDay = now.getDate();

    const curMonthNum = String(curMonthIdx + 1).padStart(2, "0");
    const curDayStr = String(curDay).padStart(2, "0");
    const curMonthLastDay = new Date(curYear, curMonthIdx + 1, 0).getDate();
    const curMonthLastDayStr = String(curMonthLastDay).padStart(2, "0");

    const nextMonthDate = new Date(curYear, curMonthIdx + 1, 1);
    const nextYear = nextMonthDate.getFullYear();
    const nextMonthIdx = nextMonthDate.getMonth();
    const nextMonthNum = String(nextMonthIdx + 1).padStart(2, "0");
    const nextMonthLastDay = new Date(nextYear, nextMonthIdx + 1, 0).getDate();
    const nextMonthLastDayStr = String(nextMonthLastDay).padStart(2, "0");

    const presets: Array<{ label: string; start: string; end: string }> = [];
    if (curDay < curMonthLastDay) {
      presets.push({
        label: `${curDay}–${curMonthLastDay} ${monthsShort[curMonthIdx]}`,
        start: `${curYear}-${curMonthNum}-${curDayStr}`,
        end: `${curYear}-${curMonthNum}-${curMonthLastDayStr}`,
      });
    }
    presets.push(
      {
        label: monthsFull[curMonthIdx],
        start: `${curYear}-${curMonthNum}-01`,
        end: `${curYear}-${curMonthNum}-${curMonthLastDayStr}`,
      },
      {
        label: monthsFull[nextMonthIdx],
        start: `${nextYear}-${nextMonthNum}-01`,
        end: `${nextYear}-${nextMonthNum}-${nextMonthLastDayStr}`,
      },
    );

    return presets;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originIata) {
      setError("Por favor, elige un aeropuerto de origen.");
      return;
    }
    if (!destinationIata) {
      setError("Por favor, elige un aeropuerto de destino.");
      return;
    }
    if (!departureDay || !returnDay) {
      setError("Por favor, selecciona el día de salida y el día de regreso.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Por favor, selecciona el rango de fechas (desde y hasta).");
      return;
    }
    const validationError = validateAlertSearchParams({
      originIata,
      destinationIata,
      departureDay: Number(departureDay),
      returnDay: Number(returnDay),
      startDate,
      endDate,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!adults) {
      setError("Por favor, selecciona el número de pasajeros.");
      return;
    }
    if (directOnly === null) {
      setError("Por favor, elige si prefieres solo vuelo directo o con escalas.");
      return;
    }
    const parsedBudget = Number(maxPriceEur);
    if (!parsedBudget || parsedBudget <= 0) {
      setError("Introduce un precio objetivo válido en euros (mayor que 0).");
      return;
    }

    const depText =
      WEEKDAYS.find((d) => d.value === Number(departureDay))?.label || "";
    const retText =
      WEEKDAYS.find((d) => d.value === Number(returnDay))?.label || "";
    const directText = directOnly ? "solo vuelos directos" : "con escalas";

    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      await api.alerts.create({
        originIata,
        destinationIata,
        departureDay: Number(departureDay),
        returnDay: Number(returnDay),
        adults: Number(adults),
        directOnly,
        maxPriceEur: parsedBudget,
        startDate: new Date(`${startDate}T00:00:00.000Z`).toISOString(),
        endDate: new Date(`${endDate}T23:59:59.999Z`).toISOString(),
      });
      resetForm();
      setSuccessMessage(
        `Alerta creada (${directText}) para todos los ${depText} ➔ ${retText} del rango seleccionado.`
      );
      onAlertCreated();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || "Error al crear la alerta");
    } finally {
      setLoading(false);
    }
  };

  const depLabel = WEEKDAYS.find((d) => d.value === Number(departureDay))?.label;
  const retLabel = WEEKDAYS.find((d) => d.value === Number(returnDay))?.label;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Buscador de alertas de vuelos por días de la semana"
      className="bg-white rounded-3xl shadow-[0_18px_45px_rgba(11,37,69,0.12)] border border-slate-200/80 p-4 sm:p-7 space-y-5"
    >
      {/* Fila 1: ORIGEN ⇄ DESTINO */}
      <div className="flex flex-col md:flex-row items-stretch md:items-end gap-3">
        <AirportSelector
          label="ORIGEN"
          value={originIata}
          onChange={setOriginIata}
          placeholder="Ej. Madrid (MAD)"
          disabledIata={destinationIata}
          disabledReason="Ya seleccionado en destino"
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
          placeholder="Ej. Londres (LON)"
          disabledIata={originIata}
          disabledReason="Ya seleccionado en origen"
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
            onChange={(e) => setDepartureDay(e.target.value)}
            className={`w-full px-3.5 py-2.5 rounded-xl bg-[#f8fafc] border border-slate-200 hover:border-slate-300 text-sm font-medium focus:outline-none focus:border-[#0096c7] cursor-pointer ${
              departureDay ? "text-[#0b2545]" : "text-slate-400 font-normal"
            }`}
          >
            <option value="" disabled>
              Elige día (ej. Viernes)
            </option>
            {WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value} className="text-[#0b2545]">
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
            onChange={(e) => setReturnDay(e.target.value)}
            className={`w-full px-3.5 py-2.5 rounded-xl bg-[#f8fafc] border border-slate-200 hover:border-slate-300 text-sm font-medium focus:outline-none focus:border-[#0096c7] cursor-pointer ${
              returnDay ? "text-[#0b2545]" : "text-slate-400 font-normal"
            }`}
          >
            <option value="" disabled>
              Elige día (ej. Domingo)
            </option>
            {WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value} className="text-[#0b2545]">
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
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="AAAA-MM-DD"
            className={`w-full px-3 py-2.5 rounded-xl bg-[#f8fafc] border border-slate-200 hover:border-slate-300 text-xs sm:text-sm font-medium focus:outline-none focus:border-[#0096c7] ${
              startDate ? "text-[#0b2545]" : "text-slate-400 font-normal"
            }`}
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
            min={startDate ? addDaysToIsoDate(startDate, 1) : undefined}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="AAAA-MM-DD"
            className={`w-full px-3 py-2.5 rounded-xl bg-[#f8fafc] border border-slate-200 hover:border-slate-300 text-xs sm:text-sm font-medium focus:outline-none focus:border-[#0096c7] ${
              endDate ? "text-[#0b2545]" : "text-slate-400 font-normal"
            }`}
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
            onChange={(e) => setAdults(e.target.value)}
            className={`w-full px-3.5 py-2.5 rounded-xl bg-[#f8fafc] border border-slate-200 hover:border-slate-300 text-sm font-medium focus:outline-none focus:border-[#0096c7] cursor-pointer ${
              adults ? "text-[#0b2545]" : "text-slate-400 font-normal"
            }`}
          >
            <option value="" disabled>
              Ej. 1 adulto
            </option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <option key={num} value={num} className="text-[#0b2545]">
                {num} {num === 1 ? "adulto" : "adultos"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Fila 3: Tipo de vuelo (Directo / Con escalas) + Presupuesto objetivo + Atajos de rango + Botón principal */}
      <div className="flex flex-col lg:flex-row lg:flex-wrap items-stretch lg:items-center justify-between gap-4 pt-1">
        <div className="flex flex-wrap items-center justify-between sm:justify-start gap-3 sm:gap-4">
          {/* Selector de Vuelo Directo vs Con Escalas */}
          <div className="flex items-center gap-2">
            <span
              id="label-flight-type"
              className="text-xs font-semibold text-[#0b2545]"
            >
              Escalas:
            </span>
            <div
              role="radiogroup"
              aria-labelledby="label-flight-type"
              className="inline-flex p-1 rounded-xl bg-[#f4f7fb] border border-slate-200"
            >
              <button
                type="button"
                role="radio"
                aria-checked={directOnly === true}
                onClick={() => setDirectOnly(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                  directOnly === true
                    ? "bg-[#0b2545] text-white shadow-2xs"
                    : "text-slate-600 hover:text-[#0b2545]"
                }`}
              >
                <span aria-hidden="true">✈️</span>
                <span>Solo directo</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={directOnly === false}
                onClick={() => setDirectOnly(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                  directOnly === false
                    ? "bg-[#0b2545] text-white shadow-2xs"
                    : "text-slate-600 hover:text-[#0b2545]"
                }`}
              >
                <span aria-hidden="true">🔄</span>
                <span>Con escalas</span>
              </button>
            </div>
          </div>

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
                value={maxPriceEur}
                onChange={(e) => setMaxPriceEur(e.target.value)}
                placeholder="Ej. 100"
                className="w-24 sm:w-28 pl-3 pr-7 py-2 rounded-xl bg-[#f8fafc] border border-slate-200 text-xs font-bold text-[#0b2545] placeholder-slate-400 placeholder:font-normal focus:outline-none focus:border-[#0096c7]"
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
            <span className="text-slate-500 mr-1 hidden xl:inline">
              Rango rápido:
            </span>
            {quickRangePresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyRangePreset(preset.start, preset.end)}
                className="px-2.5 py-1 rounded-full bg-[#f4f7fb] hover:bg-sky-50 border border-slate-200 text-slate-600 hover:text-[#0b2545] transition cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full lg:w-auto justify-center px-6 py-3 rounded-full bg-gradient-to-r from-[#0e3968] via-[#06689f] to-[#00b4d8] hover:from-[#0b2d52] hover:to-[#0096c7] text-white font-semibold text-sm shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
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
              : depLabel && retLabel
              ? `Buscar vuelos (${depLabel} a ${retLabel})`
              : "Buscar vuelos"}
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

      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium"
        >
          <span aria-hidden="true">✓ </span>
          {successMessage}
        </div>
      )}
    </form>
  );
}
