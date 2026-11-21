import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "V Flights | Monitorización inteligente de vuelos",
  description:
    "Compara tus fechas de un vistazo, deja que Vera prepare tus búsquedas y recibe el estado de cada alerta.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#f4f7fb] text-[#0b2239] selection:bg-cyan-500/20 selection:text-[#0b2545]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-[#0b2545] focus:text-white focus:text-xs focus:font-bold focus:shadow-lg"
        >
          Saltar al contenido principal
        </a>
        {children}
      </body>
    </html>
  );
}
