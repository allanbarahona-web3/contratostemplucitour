import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { VerticalNav } from "@/components/vertical-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Contratos Alma Nova",
  description: "Sistema de gestion de contratos y cobros",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body 
        className="min-h-full flex flex-col" 
        suppressHydrationWarning
        style={{ background: '#f5f5f7' }}
      >
        <Script src="/config.js" strategy="afterInteractive" />
        <VerticalNav />
        {children}
      </body>
    </html>
  );
}
