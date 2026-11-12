import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { EmpresaProvider } from "@/app/context/EmpresaContext";
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
  title: "ContaABC",
  description: "Contabilidad por Conceptos NIIF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <EmpresaProvider>
          {children}
        </EmpresaProvider>
      </body>
    </html>
  );
}