"use client";

import { useRouter } from "next/navigation";

export default function BotonAtras() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition cursor-pointer border border-slate-200 shrink-0 flex items-center gap-1.5"
    >
      <span>←</span>
      <span>Atrás</span>
    </button>
  );
}