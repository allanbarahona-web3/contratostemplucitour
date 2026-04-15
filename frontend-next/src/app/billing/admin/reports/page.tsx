"use client";

import { getStoredSession, getStoredToken } from "@/lib/auth-api";
import { getBillingAdminReports, type BillingAdminReportData } from "@/lib/billing-api";
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

const formatDate = (value?: string | null): string => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-CR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

export default function AdminReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [data, setData] = useState<BillingAdminReportData | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getBillingAdminReports({
        from: from || undefined,
        to: to || undefined,
        q: q.trim() || undefined,
        invoiceStatus: invoiceStatus || undefined,
        paymentStatus: paymentStatus || undefined,
        limitInvoices: 400,
        limitPayments: 900,
      });
      setData(result);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "No se pudo cargar reporte.");
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

  return (
    <main className="app-shell">
      <section className="card contracts-card">
        <h1>Reportes Contables</h1>
        <p className="muted">Vista para revision interna y envio manual al contador.</p>

        <div className="contracts-grid" style={{ marginTop: 12 }}>
          <label>
            Fecha desde
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>

          <label>
            Fecha hasta
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>

          <label>
            Buscar
            <input
              value={q}
              placeholder="Cliente, contrato, estado de cuenta, referencia"
              onChange={(event) => setQ(event.target.value)}
            />
          </label>

          <label>
            Estado factura
            <select value={invoiceStatus} onChange={(event) => setInvoiceStatus(event.target.value)}>
              <option value="">Todos</option>
              <option value="FACTURA_EMITIDA">FACTURA_EMITIDA</option>
              <option value="FACTURA_PARCIAL">FACTURA_PARCIAL</option>
              <option value="FACTURA_PAGADA">FACTURA_PAGADA</option>
              <option value="FACTURA_VENCIDA">FACTURA_VENCIDA</option>
              <option value="FACTURA_ANULADA">FACTURA_ANULADA</option>
            </select>
          </label>

          <label>
            Estado abono
            <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
              <option value="">Todos</option>
              <option value="ABONO_REPORTADO">ABONO_REPORTADO</option>
              <option value="ABONO_EN_REVISION">ABONO_EN_REVISION</option>
              <option value="ABONO_VERIFICADO">ABONO_VERIFICADO</option>
              <option value="ABONO_RECHAZADO">ABONO_RECHAZADO</option>
            </select>
          </label>
        </div>

        <div className="actions">
          <button type="button" className="btn" onClick={() => void load()} disabled={loading}>
            {loading ? "Cargando..." : "Actualizar reporte"}
          </button>
        </div>

        {error ? <p className="form-error" style={{ marginTop: 10 }}>{error}</p> : null}

        {data ? (
          <>
            <div className="contracts-grid" style={{ marginTop: 14 }}>
              <label>
                Facturas (cantidad)
                <input value={String(data.summary.sales.invoicesCount)} readOnly />
              </label>
              <label>
                Total facturado
                <input value={formatMoney(data.summary.sales.totalInvoicedAmount)} readOnly />
              </label>
              <label>
                NC aplicadas
                <input value={formatMoney(data.summary.sales.totalCreditNotesAppliedAmount || 0)} readOnly />
              </label>
              <label>
                Total verificado
                <input value={formatMoney(data.summary.sales.totalVerifiedAmount)} readOnly />
              </label>
              <label>
                Total pendiente
                <input value={formatMoney(data.summary.sales.totalPendingAmount)} readOnly />
              </label>
              <label>
                Saldo total
                <input value={formatMoney(data.summary.sales.totalBalanceAmount)} readOnly />
              </label>
              <label>
                Facturas vencidas
                <input value={String(data.summary.sales.overdueInvoicesCount || 0)} readOnly />
              </label>
              <label>
                Saldo vencido
                <input value={formatMoney(data.summary.sales.overdueBalanceAmount || 0)} readOnly />
              </label>
              <label>
                Abonos (cantidad)
                <input value={String(data.summary.collections.paymentsCount)} readOnly />
              </label>
              <label>
                Total abonos reportados
                <input value={formatMoney(data.summary.collections.totalPaymentsAmount)} readOnly />
              </label>
            </div>

            <h2 className="section-title">Facturas</h2>
            <div className="history-table-wrap" style={{ marginTop: 10 }}>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Factura</th>
                    <th>Estado</th>
                    <th>Vence</th>
                    <th>Dias vencida</th>
                    <th>Facturado bruto</th>
                    <th>NC aplicada</th>
                    <th>Total</th>
                    <th>Verificado</th>
                    <th>Pendiente</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.length === 0 ? (
                    <tr>
                      <td colSpan={12}><p className="history-empty">Sin facturas para los filtros.</p></td>
                    </tr>
                  ) : null}
                  {data.invoices.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDateTime(item.issuedAt)}</td>
                      <td>
                        <div className="history-col-name">{item.client.fullName}</div>
                        <div className="history-col-muted">{item.client.idNumber}</div>
                      </td>
                      <td>{item.invoiceNumber}</td>
                      <td>
                        <span className={`contract-status ${item.status === "FACTURA_PAGADA" ? "status-signed" : item.status === "FACTURA_VENCIDA" ? "status-overdue" : "status-pending"}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>{formatDate(item.paymentDueDate)}</td>
                      <td>{item.overdueDays || 0}</td>
                      <td>{formatMoney(item.amounts.grossInvoiced || item.amounts.total)}</td>
                      <td>{formatMoney(item.amounts.creditNotesApplied || 0)}</td>
                      <td>{formatMoney(item.amounts.total)}</td>
                      <td>{formatMoney(item.amounts.verified)}</td>
                      <td>{formatMoney(item.amounts.pending)}</td>
                      <td>{formatMoney(item.amounts.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="section-title">Alertas de Vencimiento</h2>
            <div className="history-table-wrap" style={{ marginTop: 10 }}>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Factura</th>
                    <th>Cliente</th>
                    <th>Fecha vencimiento</th>
                    <th>Dias vencida</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.overdueAlerts || []).length === 0 ? (
                    <tr>
                      <td colSpan={5}><p className="history-empty">Sin facturas vencidas en los filtros.</p></td>
                    </tr>
                  ) : null}
                  {(data.overdueAlerts || []).map((item) => (
                    <tr key={item.invoiceId}>
                      <td>{item.invoiceNumber}</td>
                      <td>
                        <div className="history-col-name">{item.client.fullName}</div>
                        <div className="history-col-muted">{item.client.idNumber}</div>
                      </td>
                      <td>{formatDate(item.dueDate)}</td>
                      <td>{item.overdueDays}</td>
                      <td>{formatMoney(item.balanceAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="section-title">Abonos</h2>
            <div className="history-table-wrap" style={{ marginTop: 10 }}>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Factura</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Monto</th>
                    <th>Referencia</th>
                    <th>Registrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.length === 0 ? (
                    <tr>
                      <td colSpan={8}><p className="history-empty">Sin abonos para los filtros.</p></td>
                    </tr>
                  ) : null}
                  {data.payments.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDateTime(item.reportedAt)}</td>
                      <td>
                        <div className="history-col-name">{item.client.fullName}</div>
                        <div className="history-col-muted">{item.client.idNumber}</div>
                      </td>
                      <td>{item.invoice.invoiceNumber}</td>
                      <td>{item.type}</td>
                      <td>{item.status}</td>
                      <td>{formatMoney(item.amount)}</td>
                      <td>{item.bankReference || "-"}</td>
                      <td>{item.createdByName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
