import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShellHeader } from "@/components/app-shell-header";
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
  title: "Contratos App - Next",
  description: "Migracion progresiva del frontend de contratos a Next.js",
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
      <body className="min-h-full flex flex-col">
        <AppShellHeader />
        {children}
      </body>
    </html>
  );
}
