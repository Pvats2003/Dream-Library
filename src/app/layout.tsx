import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Noto_Sans_Devanagari, Tiro_Devanagari_Hindi } from "next/font/google";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { THEME_COOKIE, isThemePref } from "@/lib/theme";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
// One consistent Hindi typeface on every phone (Android, iPhone, Windows).
const devanagari = Noto_Sans_Devanagari({ variable: "--font-devanagari", subsets: ["devanagari"], display: "swap" });
// Display serif, only for big greetings and the receipt title. Not preloaded:
// screens that don't use it never download it.
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], display: "swap", preload: false });
const tiro = Tiro_Devanagari_Hindi({ variable: "--font-tiro", subsets: ["devanagari"], weight: "400", display: "swap", preload: false });

export const metadata: Metadata = {
  title: { default: "LibraryOS", template: "%s · LibraryOS" },
  description: "Seats, students and fees for your library — on your phone.",
  applicationName: "LibraryOS",
  appleWebApp: { capable: true, title: "LibraryOS", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
    { media: "(prefers-color-scheme: dark)", color: "#16161c" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const theme = (await cookies()).get(THEME_COOKIE)?.value;
  const explicitTheme = isThemePref(theme) && theme !== "system" ? theme : undefined;

  return (
    <html lang={locale} data-theme={explicitTheme} className={`${geist.variable} ${devanagari.variable} ${fraunces.variable} ${tiro.variable}`}>
      <body className="min-h-dvh">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
