import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});
const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const metadataBase = new URL(siteUrl);

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "BrokerHub AI | SaaS Inmobiliario",
  description: "Plataforma SaaS para capturar oportunidades desde tu chat web, clasificar con IA y distribuir matches entre agentes inmobiliarios.",
  metadataBase,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "BrokerHub AI | SaaS Inmobiliario",
    description: "Plataforma SaaS para capturar oportunidades desde tu chat web, clasificar con IA y distribuir matches entre agentes inmobiliarios.",
    url: "/",
    siteName: "BrokerHub AI",
    locale: "es_ES",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${plusJakartaSans.variable} ${plusJakartaSans.className}`}>{children}</body>
    </html>
  );
}
