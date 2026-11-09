"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
    <main
      id="main-content"
      className="min-h-screen flex flex-col justify-center items-center px-4 relative overflow-hidden bg-gradient-to-br from-[#071932] via-[#0c2b53] to-[#0d3b6e]"
    >
      {/* Efecto de luz decorativo estilo V Flights */}
      <div
        aria-hidden="true"
        className="absolute right-[10%] top-12 w-[450px] h-[450px] rounded-full bg-[#00b4d8]/15 blur-3xl pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute left-[10%] bottom-10 w-[350px] h-[350px] rounded-full bg-sky-400/10 blur-3xl pointer-events-none"
      />

      <div className="w-full max-w-md z-10 py-6 sm:py-8">
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-200 hover:text-white transition"
          >
            <span aria-hidden="true">←</span>
            <span>Volver a la página de inicio de V Flights</span>
          </Link>
        </div>

        {/* Cabecera de marca */}
        <div className="text-center mb-6 sm:mb-7">
          <div className="inline-flex items-center justify-center rounded-3xl bg-white p-3.5 sm:p-4 shadow-xl mb-4">
            <img
              src="/logo.jpg"
              alt="Logo de V Flights"
              className="h-16 sm:h-20 w-auto object-contain"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Vuela cuando sea{" "}
            <span className="text-[#18c1f0]">más barato</span>
          </h1>
          <p className="text-xs sm:text-sm text-sky-100/85 mt-1.5">
            Compara tus fechas, habla con Vera y recibe alertas en Telegram
          </p>
        </div>

        {/* Tarjeta blanca de acceso */}
        <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-[0_20px_50px_rgba(7,25,50,0.35)] border border-slate-100">
          {/* Selector de pestaña Login / Registro accesible */}
          <div
            role="tablist"
            aria-label="Modo de acceso"
            className="grid grid-cols-2 gap-1.5 p-1 bg-[#f4f7fb] rounded-2xl mb-6 border border-slate-200/80"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === "login"
                  ? "bg-[#0e2a47] text-white shadow-xs"
                  : "text-slate-600 hover:text-[#0b2545]"
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === "register"
                  ? "bg-[#0e2a47] text-white shadow-xs"
                  : "text-slate-600 hover:text-[#0b2545]"
              }`}
            >
              Crear Cuenta
            </button>
          </div>

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2"
            >
              <span aria-hidden="true">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5"
              >
                CORREO ELECTRÓNICO
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full px-4 py-2.5 rounded-xl bg-[#f8fafc] border border-slate-200 text-sm text-[#0b2545] placeholder-slate-400 focus:outline-none focus:border-[#0096c7] transition"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5"
              >
                CONTRASEÑA {mode === "register" && "(MÍN. 6 CARACTERES)"}
              </label>
              <input
                id="login-password"
                type="password"
                required
                minLength={6}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl bg-[#f8fafc] border border-slate-200 text-sm text-[#0b2545] placeholder-slate-400 focus:outline-none focus:border-[#0096c7] transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-5 rounded-full bg-gradient-to-r from-[#0e3968] via-[#06689f] to-[#00b4d8] hover:from-[#0b2d52] hover:to-[#0096c7] text-white font-semibold text-sm shadow-lg shadow-cyan-500/25 transition disabled:opacity-50 cursor-pointer mt-2"
            >
              {loading
                ? "Entrando..."
                : mode === "login"
                ? "Entrar a V Flights"
                : "Crear mi cuenta"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
