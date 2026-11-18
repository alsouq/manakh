import type { Metadata, Viewport } from "next";
import { Open_Sans, Cairo } from "next/font/google";
import "./globals.css";

const latin = Open_Sans({ subsets: ["latin"], variable: "--font-latin", display: "swap" });
const arabic = Cairo({ subsets: ["arabic"], variable: "--font-arabic", display: "swap" });

export const metadata: Metadata = {
  title: "Manakh · Greenhouse control",
  description: "Climate, water and energy control for greenhouses, with a digital twin.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#d81f2a" },
    { media: "(prefers-color-scheme: dark)", color: "#b3141d" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className={`${latin.variable} ${arabic.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
