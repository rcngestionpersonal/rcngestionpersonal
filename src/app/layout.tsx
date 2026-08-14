import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
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

const DEFAULT_TITLE = "Redinmo.io | El hub que conecta colegas inmobiliarios";
const DEFAULT_DESCRIPTION =
  "Redinmo.io es el hub donde los agentes inmobiliarios conectan sus inmuebles y pedidos: carga tu inventario y recibe matches en segundos.";

export const metadata: Metadata = {
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  metadataBase,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: "/",
    siteName: "Redinmo.io",
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
    <html lang="es" suppressHydrationWarning>
      <body className={`${plusJakartaSans.variable} ${plusJakartaSans.className}`}>
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem storageKey="redinmo-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
