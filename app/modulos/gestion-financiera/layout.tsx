// app/modulos/gestion-financiera/layout.tsx (o la ruta correspondiente)

import React, { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gestión Financiera NIIF",
};

interface GestionFinancieraLayoutProps {
  children: ReactNode;
}

export default function GestionFinancieraLayout({
  children,
}: GestionFinancieraLayoutProps) {
  return <>{children}</>;
}