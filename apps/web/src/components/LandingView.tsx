"use client";

import React from "react";
import Link from "next/link";

export function LandingView() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f4f7fb] text-[#0b2545]">
      {/* Barra de Navegación Superior con Login arriba a la derecha */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-3">
          {/* Marca V Flights */}
          <div className="flex items-center gap-6 sm:gap-8">
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

            <nav
              aria-label="Secciones de la página de inicio"
              className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600"
            >
              <a
                href="#escapadas"
                className="hover:text-[#0096c7] transition py-1"
              >
                Escapadas semanales
              </a>
              <a
                href="#como-funciona"
                className="hover:text-[#0096c7] transition py-1"
              >
                Cómo funciona
              </a>
              <a
                href="#agente-vera"
                className="hover:text-[#0096c7] transition py-1"
              >
                Vera · Agente IA
              </a>
            </nav>
          </div>

          {/* Esquina superior derecha: Opción de Login */}
          <div className="flex items-center">
            <Link
              href="/login"
              className="px-4 sm:px-5 py-2 rounded-full bg-gradient-to-r from-[#0e3968] via-[#06689f] to-[#00b4d8] hover:opacity-95 text-white text-xs font-bold shadow-md shadow-cyan-500/20 transition"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1 flex flex-col">
        {/* Sección HERO Principal */}
        <section
          aria-labelledby="hero-heading"
          className="relative bg-gradient-to-br from-[#071932] via-[#0c2b53] to-[#0d3b6e] pt-10 sm:pt-14 pb-14 sm:pb-20 overflow-hidden"
        >
          {/* Aves de origami decorativas y luz cian */}
          <div
            aria-hidden="true"
            className="pointer-events-none select-none absolute inset-0 overflow-hidden"
          >
            <div className="absolute right-[6%] top-6 w-[480px] h-[480px] rounded-full bg-[#00b4d8]/15 blur-3xl" />
            <div className="absolute left-[4%] bottom-0 w-[340px] h-[340px] rounded-full bg-sky-400/10 blur-3xl" />
            <svg
              className="hidden lg:block absolute right-[5%] top-8 w-[480px] h-[290px] text-[#00b4d8]"
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
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-sky-200 mb-5">
                <span aria-hidden="true" className="text-[#18c1f0]">
                  🛫
                </span>
                <span>Especialistas en escapadas semanales flexibles</span>
              </div>

              <h1
                id="hero-heading"
                className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.12]"
              >
                Vuela cuando sea{" "}
                <span className="text-[#18c1f0]">más barato</span>, no solo
                cuando toca.
              </h1>

              <p className="text-sm sm:text-lg text-sky-100/85 mt-5 leading-relaxed max-w-2xl">
                ¿Quieres hacer una escapada de{" "}
                <strong>viernes a domingo</strong> (o de lunes a miércoles) en
                los próximos meses, pero te da igual qué fecha exacta volar
                mientras sea un chollo? Configura tus días de la semana
                favoritos y deja que <strong>V Flights</strong> compare todas
                las opciones por ti y te avise en Telegram cuando el precio
                caiga por debajo de tu objetivo.
              </p>

              <div className="flex flex-wrap items-center gap-3.5 mt-7 sm:mt-8">
                <Link
                  href="/login"
                  className="w-full sm:w-auto justify-center px-7 py-3.5 rounded-full bg-gradient-to-r from-[#00b4d8] to-[#0077b6] hover:from-[#18c1f0] hover:to-[#0096c7] text-white font-bold text-sm shadow-xl shadow-cyan-500/25 flex items-center gap-2 transition"
                >
                  <span>Empezar a buscar escapadas</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>

            {/* Tarjeta visual de demostración del funcionamiento por escapadas semanales */}
            <div
              aria-label="Ejemplo interactivo de una alerta de Madrid a Roma"
              className="mt-10 sm:mt-12 bg-white rounded-3xl p-4 sm:p-8 shadow-[0_24px_60px_rgba(7,25,50,0.35)] border border-slate-100"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span
                        aria-hidden="true"
                        className="w-2 h-2 rounded-full bg-emerald-500"
                      />
                      Vuelo encontrado
                    </span>
                    <span className="px-3 py-1 rounded-full bg-sky-50 text-[#0077b6] border border-sky-200/70 text-xs font-semibold">
                      <span aria-hidden="true">📅 </span>
                      Escapada recurrente: Todos los Viernes ➔ Domingo
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-3xl font-extrabold text-[#0b2545] flex flex-wrap items-center gap-2">
                    <span>Madrid</span>
                    <span aria-hidden="true" className="text-[#0096c7] font-normal">
                      →
                    </span>
                    <span className="sr-only">a</span>
                    <span>Roma</span>
                    <span className="text-xs font-normal text-slate-500">
                      (MAD – ROM · Noviembre · 1 adulto)
                    </span>
                  </h2>
                </div>

                <div className="grid grid-cols-2 sm:flex items-center gap-2.5 sm:gap-3">
                  <div className="bg-[#f4f7fb] border border-slate-200/60 rounded-2xl px-4 py-2.5 text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      MEJOR ESCAPADA
                    </span>
                    <span className="text-lg sm:text-xl font-extrabold text-emerald-600 block">
                      49 €
                    </span>
                  </div>
                  <div className="bg-[#eff8ff] border border-cyan-200/60 rounded-2xl px-4 py-2.5 text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      TU OBJETIVO
                    </span>
                    <span className="text-lg sm:text-xl font-extrabold text-[#0096c7] block">
                      85 €
                    </span>
                  </div>
                </div>
              </div>

              {/* Ejemplo visual de las combinaciones comparadas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5">
                <div className="rounded-2xl p-4 bg-[#f8fafc] border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-600 block">
                    Vie 6 nov → Dom 8 nov
                  </span>
                  <span className="text-[11px] text-slate-500 mt-2 block">
                    Supera objetivo
                  </span>
                  <span className="text-lg font-extrabold text-slate-500 block">
                    112 €
                  </span>
                </div>

                <div className="relative rounded-2xl p-4 bg-[#0e2a47] text-white shadow-lg shadow-[#0e2a47]/15">
                  <span className="absolute top-3.5 right-3.5 px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-bold">
                    ¡Chollo!
                  </span>
                  <span className="text-xs font-bold text-sky-200 block">
                    Vie 13 nov → Dom 15 nov
                  </span>
                  <span className="text-[11px] text-sky-200/80 mt-2 block">
                    Vuelo directo · Ryanair
                  </span>
                  <span className="text-xl font-extrabold text-[#18c1f0] block">
                    49 €
                  </span>
                </div>

                <div className="relative rounded-2xl p-4 bg-white border-2 border-cyan-400/70">
                  <span className="text-xs font-bold text-[#0b2545] block">
                    Vie 20 nov → Dom 22 nov
                  </span>
                  <span className="text-[11px] text-emerald-700 font-semibold mt-2 block">
                    Dentro de tu objetivo
                  </span>
                  <span className="text-lg font-extrabold text-[#0b2545] block">
                    74 €
                  </span>
                </div>

                <div className="rounded-2xl p-4 bg-[#f8fafc] border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-600 block">
                    Vie 27 nov → Dom 29 nov
                  </span>
                  <span className="text-[11px] text-slate-500 mt-2 block">
                    Supera objetivo
                  </span>
                  <span className="text-lg font-extrabold text-slate-500 block">
                    98 €
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Sección: ¿Por qué V Flights es ideal para escapadas semanales? */}
        <section
          id="escapadas"
          aria-labelledby="escapadas-heading"
          className="py-12 sm:py-16 max-w-7xl mx-auto px-4 sm:px-6"
        >
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#0077b6]">
              Pensado para viajeros flexibles
            </span>
            <h2
              id="escapadas-heading"
              className="text-2xl sm:text-4xl font-extrabold text-[#0b2545] mt-2 tracking-tight"
            >
              Diseñado para tus escapadas semanales
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-3 leading-relaxed">
              Los buscadores tradicionales te obligan a elegir una única fecha
              fija. V Flights trabaja con patrones de días de la semana para
              encontrar exactamente cuándo merece la pena volar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            <article className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-[0_10px_30px_rgba(11,37,69,0.04)]">
              <div
                aria-hidden="true"
                className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-2xl mb-4"
              >
                📅
              </div>
              <h3 className="text-base font-extrabold text-[#0b2545]">
                Patrones por días de la semana
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Elige tu combinación ideal —como{" "}
                <strong>Viernes a Domingo</strong> para escapadas de fin de
                semana o <strong>Lunes a Miércoles</strong> entre diario— dentro
                de un rango de fechas. Nuestro motor calcula y vigila todas las
                combinaciones automáticamente.
              </p>
            </article>

            <article
              id="agente-vera"
              className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-[0_10px_30px_rgba(11,37,69,0.04)]"
            >
              <div
                aria-hidden="true"
                className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-2xl mb-4"
              >
                ✨
              </div>
              <h3 className="text-base font-extrabold text-[#0b2545]">
                Vera · Agente IA con 2 Skills
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                ¿No sabes adónde escaparte? Pídele a <strong>Vera</strong> que
                te recomiende{" "}
                <strong>5 destinos baratos de playa o montaña</strong> o
                escríbele en lenguaje natural:{" "}
                <em>
                  «Vuelos de Madrid a Lisboa de viernes a domingo en noviembre
                  por menos de 70 €»
                </em>
                .
              </p>
            </article>

            <article className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-[0_10px_30px_rgba(11,37,69,0.04)]">
              <div
                aria-hidden="true"
                className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-2xl mb-4"
              >
                📲
              </div>
              <h3 className="text-base font-extrabold text-[#0b2545]">
                Alertas en tiempo real por Telegram
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Olvídate de refrescar precios cada día. Cuando una de las fechas
                de tu escapada baja de tu presupuesto máximo, recibes un aviso
                en Telegram con aerolínea, hora de salida, escalas y enlace
                directo a Google Flights.
              </p>
            </article>
          </div>
        </section>

        {/* Sección: Cómo funciona en 3 pasos */}
        <section
          id="como-funciona"
          aria-labelledby="como-funciona-heading"
          className="py-12 sm:py-14 bg-white border-y border-slate-200/70"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#0077b6]">
                  Paso a paso
                </span>
                <h2
                  id="como-funciona-heading"
                  className="text-2xl sm:text-3xl font-extrabold text-[#0b2545] mt-2 tracking-tight"
                >
                  Configura tu alerta en menos de 30 segundos
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-3 leading-relaxed">
                  Tanto desde el comparador visual como conversando con nuestro
                  Agente IA Vera en la esquina inferior derecha, tu búsqueda
                  queda encolada al instante.
                </p>
                <div className="mt-6">
                  <Link
                    href="/login"
                    className="w-full sm:w-auto justify-center inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#0e2a47] hover:bg-[#0077b6] text-white text-xs font-bold transition shadow-md"
                  >
                    <span>Crear mi primera alerta</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-[#f4f7fb] border border-slate-200/80">
                  <span
                    aria-hidden="true"
                    className="w-7 h-7 rounded-full bg-[#0e2a47] text-[#18c1f0] font-extrabold text-xs flex items-center justify-center mb-3"
                  >
                    1
                  </span>
                  <h3 className="text-sm font-bold text-[#0b2545]">
                    Define días y rango
                  </h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Indica origen, destino, qué días de la semana quieres salir
                    y volver (ej. Viernes a Domingo) y en qué fechas o mes.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[#f4f7fb] border border-slate-200/80">
                  <span
                    aria-hidden="true"
                    className="w-7 h-7 rounded-full bg-[#0e2a47] text-[#18c1f0] font-extrabold text-xs flex items-center justify-center mb-3"
                  >
                    2
                  </span>
                  <h3 className="text-sm font-bold text-[#0b2545]">
                    Marca tu precio tope
                  </h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Fija cuánto estás dispuesto a pagar como máximo por
                    pasajero. El motor descartará los vuelos caros por ti.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[#f4f7fb] border border-slate-200/80">
                  <span
                    aria-hidden="true"
                    className="w-7 h-7 rounded-full bg-[#0e2a47] text-[#18c1f0] font-extrabold text-xs flex items-center justify-center mb-3"
                  >
                    3
                  </span>
                  <h3 className="text-sm font-bold text-[#0b2545]">
                    Recibe el chollo y vuela
                  </h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Consulta las gráficas comparativas en tu panel o recibe la
                    alerta directamente en tu Telegram con link de reserva.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Banner Final */}
        <section className="py-12 sm:py-14 max-w-7xl mx-auto px-4 sm:px-6 w-full">
          <div className="rounded-3xl bg-gradient-to-r from-[#071932] via-[#0c2b53] to-[#0077b6] p-7 sm:p-12 text-center text-white shadow-xl">
            <h2 className="text-xl sm:text-4xl font-extrabold tracking-tight">
              Vuela cuando sea{" "}
              <span className="text-[#18c1f0]">más barato</span>, no solo cuando
              toca.
            </h2>
            <p className="text-xs sm:text-sm text-sky-100/85 mt-3 max-w-xl mx-auto">
              Monitoriza tus próximas escapadas semanales con V Flights y deja
              que Vera y nuestras alertas en Telegram encuentren el mejor
              momento para volar.
            </p>
          </div>
        </section>
      </main>

      {/* Pie de página */}
      <footer className="mt-auto py-6 border-t border-slate-200/80 bg-white text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-[#0b2545]">
            <img
              src="/logo.jpg"
              alt="Logo de V Flights"
              className="h-6 w-auto object-contain"
            />
            <span>V Flights</span>
          </div>
          <span>
            Comparador de escapadas con Agente IA y alertas en Telegram
          </span>
        </div>
      </footer>
    </div>
  );
}
