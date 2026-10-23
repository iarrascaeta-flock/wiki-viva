import type { Metadata } from "next";
import { Zalando_Sans } from "next/font/google";
import "./globals.css";

// Tipografía del design system de Flock IT: Zalando Sans para todo (400 texto, 700–800 títulos).
const zalandoSans = Zalando_Sans({
  variable: "--font-zalando",
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  adjustFontFallback: false, // next/font no tiene métricas de Zalando Sans
});

export const metadata: Metadata = {
  title: "Wiki viva",
  description: "Terminología y casos especiales del negocio",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${zalandoSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
