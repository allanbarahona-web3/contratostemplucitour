"use client";

import { getStoredSession, getStoredToken } from "@/lib/auth-api";
import {
  approveBillingCreditNote,
  listBillingPendingCreditNotes,
  rejectBillingCreditNote,
  type BillingPendingCreditNoteItem,
} from "@/lib/billing-api";
import { ToastNotification, useToast } from "@/components/toast-notification";
import { PageLoader } from "@/components/loading-spinner";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const formatMoney = (value: number) => `USD ${Number.isFinite(value) ? value.toFixed(2) : "0.00"}`;

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-CR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AdminCreditNotesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<BillingPendingCreditNoteItem[]>([]);
  const [actionBusy, setActionBusy] = useState("");
  const { toasts, showSuccess, showError, dismissToast } = useToast();

  const [rejectModalId, setRejectModalId] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const result = await listBillingPendingCreditNotes({ q: q.trim() || undefined, limit: 120 });
      setItems(result);
    } catch (fetchError) {
      showError(fetchError instanceof Error ? fetchError.message : "No se pudo cargar cola de aprobacion.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/");
      return;
    }

    const session = getStoredSession();
    const role = String(session?.user?.role || "").toUpperCase();
    if (role !== "ADMIN") {
      router.replace("/billing");
      return;
    }

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const onApprove = async (item: BillingPendingCreditNoteItem) => {
    setActionBusy(`approve:${item.id}`);
    try {
      await approveBillingCreditNote(item.id, "Aprobada por admin");
      showSuccess(`Nota ${item.creditNoteNumber} aprobada y aplicada.`);
      await load();
    } catch (actionError) {
      showError(actionError instanceof Error ? actionError.message : "No se pudo aprobar.");
    } finally {
      setActionBusy("");
    }
  };

  const onReject = async () => {
    const id = String(rejectModalId || "").trim();
    const reason = String(rejectReason || "").trim();
    if (!id || !reason) {
      showError("Debes indicar motivo de rechazo.");
      return;
    }

    setActionBusy(`reject:${id}`);
    try {
      await rejectBillingCreditNote(id, reason);
      showSuccess("Nota de credito rechazada.");
      setRejectModalId("");
      setRejectReason("");
      await load();
    } catch (actionError) {
      showError(actionError instanceof Error ? actionError.message : "No se pudo rechazar.");
    } finally {
      setActionBusy("");
    }
  };

  return (
    <main className="app-shell">
      {loading && items.length === 0 ? (
        <PageLoader />
      ) : (
        <section className="card contracts-card">
          <h1>Cola Admin - Notas de Credito</h1>
          <p className="muted">Solo admin puede aprobar o rechazar. Ninguna nota pendiente impacta saldos.</p>

        <div className="contracts-grid" style={{ marginTop: 12 }}>
          <label>
            Buscar
            <input
              value={q}
              placeholder="Cliente, contrato, numero NC"
              onChange={(event) => setQ(event.target.value)}
            />
          </label>
        </div>

        <div className="actions">
          <button type="button" className="btn" onClick={() => void load()} disabled={loading}>
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </div>

        <div className="history-table-wrap" style={{ marginTop: 14 }}>
          <table className="history-table">
            <thead>
              <tr>
                <th>NC</th>
                <th>Cliente</th>
                <th>Contrato</th>
                <th>Monto</th>
                <th>Solicitada</th>
                <th>Motivo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <p className="history-empty">No hay notas pendientes de aprobacion.</p>
                  </td>
                </tr>
              ) : null}

              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.creditNoteNumber}</td>
                  <td>
                    <div className="history-col-name">{item.client.fullName}</div>
                    <div className="history-col-muted">{item.client.idNumber}</div>
                  </td>
                  <td>{item.contractNumber}</td>
                  <td>{formatMoney(item.amount)}</td>
                  <td>
                    <div>{formatDateTime(item.issuedAt)}</div>
                    <div className="history-col-muted">Por: {item.requestedBy.name}</div>
                  </td>
                  <td>{item.reason}</td>
                  <td>
                    <div className="history-actions">
                      <button
                        type="button"
                        className="btn"
                        onClick={() => void onApprove(item)}
                        disabled={actionBusy === `approve:${item.id}`}
                      >
                        {actionBusy === `approve:${item.id}` ? "..." : "Aprobar"}
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setRejectModalId(item.id);
                          setRejectReason("");
                        }}
                        disabled={actionBusy === `reject:${item.id}`}
                      >
                        Rechazar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {rejectModalId ? (
        <section className="viewer-modal" onClick={() => setRejectModalId("")}>
          <div className="viewer-panel reject-modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="viewer-head">
              <h2>Rechazar nota de credito</h2>
              <button type="button" className="btn btn-secondary" onClick={() => setRejectModalId("")}>Cerrar</button>
            </div>

            <div className="viewer-body">
              <label className="reject-modal-label">
                Motivo
                <textarea
                  rows={5}
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="Indica el motivo por el cual no procede"
                />
              </label>

              <div className="actions" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => void onReject()}
                  disabled={actionBusy === `reject:${rejectModalId}`}
                >
                  {actionBusy === `reject:${rejectModalId}` ? "Guardando..." : "Confirmar rechazo"}
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <ToastNotification toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}
