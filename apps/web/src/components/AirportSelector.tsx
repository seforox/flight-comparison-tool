"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import {
  api,
  AirportItem,
  AIRPORTS_CATALOG,
  getCachedAirport,
} from "@/lib/api";

interface AirportSelectorProps {
  label: string;
  value: string;
  onChange: (iata: string) => void;
  placeholder?: string;
  disabledIata?: string;
  disabledReason?: string;
}

export function AirportSelector({
  label,
  value,
  onChange,
  placeholder = "Elige aeropuerto",
  disabledIata,
  disabledReason = "Ya seleccionado",
}: AirportSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [airports, setAirports] = useState<AirportItem[]>(AIRPORTS_CATALOG);
  const [totalInDb, setTotalInDb] = useState<number>(8021);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedAirport, setSelectedAirport] = useState<AirportItem | undefined>(
    () => getCachedAirport(value)
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const listboxId = useId();

  // Resolver el aeropuerto seleccionado desde caché o desde la tabla Airport en PostgreSQL
  useEffect(() => {
    if (!value) {
      setSelectedAirport(undefined);
      return;
    }
    const cached = getCachedAirport(value);
    if (cached) {
      setSelectedAirport(cached);
      return;
    }
    let active = true;
    api.airports.getByIata(value).then((found) => {
      if (active && found) {
        setSelectedAirport(found);
      }
    });
    return () => {
      active = false;
    };
  }, [value]);

  // Consultar la tabla Airport de PostgreSQL cuando se abre el selector o cambia la búsqueda
  useEffect(() => {
    if (!open) return;

    let active = true;
    setLoading(true);

    const timer = setTimeout(() => {
      api.airports
        .search(query, 60)
        .then((res) => {
          if (!active) return;
          if (res && Array.isArray(res.items)) {
            setAirports(res.items);
            if (res.total) setTotalInDb(res.total);
          }
        })
        .catch(() => {
          if (!active) return;
          const q = query.trim().toLowerCase();
          setAirports(
            AIRPORTS_CATALOG.filter(
              (a) =>
                a.city.toLowerCase().includes(q) ||
                a.iata.toLowerCase().includes(q) ||
                a.name.toLowerCase().includes(q) ||
                a.country.toLowerCase().includes(q)
            )
          );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 160);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const customIataCandidate = query.trim().toUpperCase();
  const isCustomValid = /^[A-Z]{3}$/.test(customIataCandidate);
  const normalizedDisabledIata = disabledIata?.trim().toUpperCase() || "";
  const isCustomDisabled =
    Boolean(normalizedDisabledIata) && customIataCandidate === normalizedDisabledIata;

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <label
        id={labelId}
        className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
      >
        {label}
      </label>

      <button
        type="button"
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2.5 rounded-xl bg-[#f8fafc] border border-slate-200 hover:border-slate-300 text-sm text-[#0b2545] flex items-center justify-between cursor-pointer transition shadow-2xs text-left"
      >
        {selectedAirport ? (
          <span className="truncate font-medium text-[#0b2545]">
            {selectedAirport.city} ({selectedAirport.iata})
          </span>
        ) : value ? (
          <span className="truncate font-medium text-[#0b2545]">
            Aeropuerto ({value})
          </span>
        ) : (
          <span className="text-slate-500 font-normal">{placeholder}</span>
        )}
        <svg
          aria-hidden="true"
          className={`w-4 h-4 text-slate-500 shrink-0 ml-2 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={labelId}
          className="absolute z-50 mt-1.5 w-full sm:min-w-[320px] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/60">
            <input
              type="text"
              autoFocus
              aria-label={`Filtrar aeropuerto para ${label}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ciudad, país o código IATA (ej. Estocolmo, NCE, HND)..."
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-[#0b2545] placeholder-slate-400 focus:outline-none focus:border-[#0096c7]"
            />
            <div className="mt-1.5 px-1 flex items-center justify-between text-[10px] text-slate-500">
              <span>
                {loading
                  ? "Buscando en base de datos..."
                  : `${airports.length} mostrados · ${totalInDb.toLocaleString("es-ES")} aeropuertos IATA`}
              </span>
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-[#0077b6] hover:underline font-semibold cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {airports.map((airport) => {
              const isSelected = airport.iata === value;
              const isDisabled =
                Boolean(normalizedDisabledIata) &&
                airport.iata.toUpperCase() === normalizedDisabledIata;
              return (
                <button
                  key={airport.iata}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={isDisabled}
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    setSelectedAirport(airport);
                    onChange(airport.iata);
                    setQuery("");
                    setOpen(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left flex items-center justify-between transition ${
                    isDisabled
                      ? "bg-slate-50 opacity-50 cursor-not-allowed"
                      : isSelected
                      ? "bg-sky-50/50 hover:bg-sky-50/70 cursor-pointer"
                      : "hover:bg-sky-50/70 cursor-pointer"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-semibold text-[#0b2545] truncate">
                      {airport.city} ({airport.iata}){" "}
                      <span className="text-slate-500 font-normal">
                        · {airport.country}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {isDisabled ? disabledReason : airport.name}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[#0b2545] font-mono text-[11px] font-bold shrink-0">
                    {airport.iata}
                  </span>
                </button>
              );
            })}

            {isCustomValid &&
              !airports.some((a) => a.iata === customIataCandidate) && (
                <button
                  type="button"
                  role="option"
                  aria-selected={value === customIataCandidate}
                  aria-disabled={isCustomDisabled}
                  disabled={isCustomDisabled}
                  onClick={() => {
                    if (isCustomDisabled) return;
                    onChange(customIataCandidate);
                    setQuery("");
                    setOpen(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left flex items-center justify-between transition ${
                    isCustomDisabled
                      ? "bg-slate-50 opacity-50 cursor-not-allowed"
                      : "bg-cyan-50/60 hover:bg-cyan-100/60 cursor-pointer"
                  }`}
                >
                  <span className="text-xs text-[#0077b6]">
                    {isCustomDisabled ? (
                      <span className="text-slate-500">
                        {customIataCandidate} · {disabledReason}
                      </span>
                    ) : (
                      <>
                        Usar código IATA:{" "}
                        <strong className="font-mono">{customIataCandidate}</strong>
                      </>
                    )}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-[#0b2545] font-mono text-xs font-bold">
                    {customIataCandidate}
                  </span>
                </button>
              )}

            {!loading && airports.length === 0 && !isCustomValid && (
              <div className="p-3.5 text-center text-xs text-slate-500">
                Sin coincidencias en los {totalInDb.toLocaleString("es-ES")} aeropuertos IATA.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
