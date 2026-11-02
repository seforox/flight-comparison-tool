"use client";

import React, { useState, useRef, useEffect } from "react";
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
  placeholder = "Buscar ciudad o código IATA (ej. MAD)",
}: AirportSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedAirport = AIRPORTS_CATALOG.find((a) => a.iata === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-slate-300 mb-1.5">
        {label}
      </label>

      <div
        onClick={() => setOpen(true)}
        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-sm text-white flex items-center justify-between cursor-pointer transition"
      >
        {selectedAirport ? (
          <div className="flex items-center gap-2 truncate">
            <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-mono text-xs font-bold">
              {selectedAirport.iata}
            </span>
            <span className="truncate text-slate-200">{selectedAirport.city}</span>
            <span className="text-xs text-slate-500 hidden sm:inline">
              ({selectedAirport.country})
            </span>
          </div>
        ) : value ? (
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-mono text-xs font-bold">
              {value}
            </span>
            <span className="text-slate-300 text-xs">Código IATA personalizado</span>
          </div>
        ) : (
          <span className="text-slate-500 text-xs">{placeholder}</span>
        )}
        <span className="text-slate-500 text-xs ml-2">▾</span>
      </div>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-slate-800">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escribe ciudad o 3 letras IATA (ej. LON, PMI, BCN)..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/60">
            {filtered.map((airport) => (
              <button
                key={airport.iata}
                type="button"
                onClick={() => {
                  onChange(airport.iata);
                  setQuery("");
                  setOpen(false);
                }}
                className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800/80 flex items-center justify-between transition cursor-pointer"
              >
                <div>
                  <div className="text-xs font-medium text-slate-200">
                    {airport.city}{" "}
                    <span className="text-slate-500 font-normal">· {airport.country}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate max-w-[210px]">
                    {airport.name}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-sky-300 font-mono text-xs font-semibold">
                  {airport.iata}
                </span>
              </button>
            ))}

            {isCustomValid &&
              !filtered.some((a) => a.iata === customIataCandidate) && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(customIataCandidate);
                    setQuery("");
                    setOpen(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-left bg-sky-500/10 hover:bg-sky-500/20 flex items-center justify-between transition cursor-pointer"
                >
                  <span className="text-xs text-sky-300">
                    Usar código IATA personalizado:{" "}
                    <strong className="font-mono">{customIataCandidate}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-200 font-mono text-xs font-bold">
                    {customIataCandidate}
                  </span>
                </button>
              )}

            {filtered.length === 0 && !isCustomValid && (
              <div className="p-3 text-center text-xs text-slate-500">
                No hay coincidencias. Escribe un código IATA de 3 letras (ej. BER) para usarlo directamente.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
