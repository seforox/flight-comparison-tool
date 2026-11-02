import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SkyRadar AI | Monitorización Inteligente de Vuelos Recurrentes",
  description:
    "Configura alertas recurrentes de vuelos con patrones semanales, recibe avisos instantáneos en Telegram y descubre chollos con nuestro Agente IA Multi-Skill.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-[#070b14] text-slate-100 selection:bg-sky-500/30 selection:text-sky-200">
        {children}
      </body>
    </html>
  );
}
