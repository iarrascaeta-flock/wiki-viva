import type { Metadata } from "next";
import { Zalando_Sans, Zalando_Sans_SemiExpanded } from "next/font/google";
import "./globals.css";

// Tipografías del design system de Flock IT: Zalando Sans para texto, SemiExpanded para títulos e interfaz.
const zalandoSans = Zalando_Sans({
  variable: "--font-zalando",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  adjustFontFallback: false, // next/font no tiene métricas de Zalando Sans
});

const zalandoSemi = Zalando_Sans_SemiExpanded({
  variable: "--font-zalando-semi",
  subsets: ["latin"],
  weight: ["400", "600"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Wiki viva",
  description: "Terminología y casos especiales del negocio",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${zalandoSans.variable} ${zalandoSemi.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
