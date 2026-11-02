"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response =
        mode === "login"
          ? await api.auth.login(email, password)
          : await api.auth.register(email, password);

      setToken(response.accessToken);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Error al procesar la solicitud");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Efecto radar decorativo de fondo */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Cabecera de marca */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/25 mb-4">
            <span className="text-2xl">✈️</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-sky-100 to-sky-400 bg-clip-text text-transparent">
            SkyRadar AI
          </h1>
          <p className="text-sm text-slate-400 mt-1.5">
            Monitorización recurrente de vuelos con Agente IA y alertas en Telegram
          </p>
        </div>

        {/* Tarjeta principal */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl">
          {/* Selector de pestaña Login / Registro */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950/80 rounded-xl mb-6 border border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`py-2.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${
                mode === "login"
                  ? "bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`py-2.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${
                mode === "register"
                  ? "bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Crear Cuenta
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Contraseña {mode === "register" && "(mínimo 6 caracteres)"}
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-sky-500/20 transition disabled:opacity-50 cursor-pointer mt-2"
            >
              {loading
                ? "Procesando..."
                : mode === "login"
                ? "Entrar al Radar de Vuelos"
                : "Registrarme y Continuar"}
            </button>
          </form>
        </div>

        {/* Pie informativo */}
        <div className="mt-6 grid grid-cols-3 gap-2 text-center text-[11px] text-slate-400">
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-2.5">
            🤖 <span className="block text-slate-300 font-medium mt-0.5">2 Skills IA</span>
            Búsqueda y Recomendador
          </div>
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-2.5">
            ⚡ <span className="block text-slate-300 font-medium mt-0.5">Motor BullMQ</span>
            Ignav API & Mocks
          </div>
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-2.5">
            📲 <span className="block text-slate-300 font-medium mt-0.5">Push Telegram</span>
            Escalas, hora y link
          </div>
        </div>
      </div>
    </div>
  );
}
