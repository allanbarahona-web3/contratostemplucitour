"use client";

import Link from "next/link";

export default function ReceiptApprovalsPage() {
  return (
    <main className="app-shell">
      <section className="card contracts-card">
        <h1>Aprobar Recibos</h1>
        <p className="muted">
          Esta página está en construcción. Los recibos pendientes se aprueban desde{" "}
          <Link href="/billing" className="text-blue-600 underline">
            Estados de Cuenta
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
