"use client";

import { Printer } from "lucide-react";

export default function BottoneStampa() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="fixed bottom-5 right-5 inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white shadow-lg print:hidden"
    >
      <Printer size={16} /> Stampa
    </button>
  );
}
