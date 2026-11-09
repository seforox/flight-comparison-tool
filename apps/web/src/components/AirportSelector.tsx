"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { AIRPORTS_CATALOG } from "@/lib/api";

interface AirportSelectorProps {
  label: string;
  value: string;
  onChange: (iata: string) => void;
  placeholder?: string;
}

export function AirportSelector({
  label,
  value,
  onChange,
  placeholder = "Elige aeropuerto",
}: AirportSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const listboxId = useId();

  const selectedAirport = AIRPORTS_CATALOG.find((a) => a.iata === value);

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

  const filtered = AIRPORTS_CATALOG.filter(
    (a) =>
      a.city.toLowerCase().includes(query.toLowerCase()) ||
      a.iata.toLowerCase().includes(query.toLowerCase()) ||
      a.country.toLowerCase().includes(query.toLowerCase())
  );

  const customIataCandidate = query.trim().toUpperCase();
  const isCustomValid = /^[A-Z]{3}$/.test(customIataCandidate);

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
          className="absolute z-50 mt-1.5 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/60">
            <input
              type="text"
              autoFocus
              aria-label={`Filtrar aeropuerto para ${label}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ciudad o código IATA (ej. HND, ROM, LON)..."
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-[#0b2545] placeholder-slate-400 focus:outline-none focus:border-[#0096c7]"
            />
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
            {filtered.map((airport) => {
              const isSelected = airport.iata === value;
              return (
                <button
                  key={airport.iata}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(airport.iata);
                    setQuery("");
                    setOpen(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left hover:bg-sky-50/70 flex items-center justify-between transition cursor-pointer ${
                    isSelected ? "bg-sky-50/50" : ""
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
                      {airport.name}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[#0b2545] font-mono text-[11px] font-bold shrink-0">
                    {airport.iata}
                  </span>
                </button>
              );
            })}

            {isCustomValid &&
              !filtered.some((a) => a.iata === customIataCandidate) && (
                <button
                  type="button"
                  role="option"
                  aria-selected={value === customIataCandidate}
                  onClick={() => {
                    onChange(customIataCandidate);
                    setQuery("");
                    setOpen(false);
                  }}
                  className="w-full px-4 py-2.5 text-left bg-cyan-50/60 hover:bg-cyan-100/60 flex items-center justify-between transition cursor-pointer"
                >
                  <span className="text-xs text-[#0077b6]">
                    Usar código IATA personalizado:{" "}
                    <strong className="font-mono">{customIataCandidate}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-[#0b2545] font-mono text-xs font-bold">
                    {customIataCandidate}
                  </span>
                </button>
              )}

            {filtered.length === 0 && !isCustomValid && (
              <div className="p-3.5 text-center text-xs text-slate-500">
                Sin coincidencias. Escribe 3 letras IATA (ej. BER) para usar
                cualquier aeropuerto.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
