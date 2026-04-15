"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredSession } from "@/lib/auth-api";
import {
  getCurrentExchangeRate,
  getExchangeRateHistory,
  setExchangeRate,
  type ExchangeRate,
} from "@/lib/exchange-rate-api";

export default function AdminExchangeRatePage() {
  const router = useRouter();
  const session = getStoredSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentRate, setCurrentRate] = useState<ExchangeRate | null>(null);
  const [history, setHistory] = useState<ExchangeRate[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [date, setDate] = useState("");
  const [buyRate, setBuyRate] = useState("");
  const [sellRate, setSellRate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!session?.user?.id) {
      router.replace("/");
      return;
    }

    const role = String(session.user.role || "").toUpperCase();
    if (role !== "ADMIN") {
      router.replace("/contracts");
      return;
    }

    loadData();
    // Set today's date as default (Costa Rica time)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setDate(`${year}-${month}-${day}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [current, hist] = await Promise.all([
        getCurrentExchangeRate(),
        getExchangeRateHistory(30),
      ]);

      setCurrentRate(current);
      setHistory(hist);

      // Pre-populate form with today's rate if it exists
      if (current) {
        setBuyRate(current.buyRate.toString());
        setSellRate(current.sellRate.toString());
        setNotes(current.notes || "");
      }
    } catch (err: any) {
      setError(err.message || "Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const buy = parseFloat(buyRate);
    const sell = parseFloat(sellRate);

    if (!date) {
      setError("Debe seleccionar una fecha");
      return;
    }

    if (isNaN(buy) || buy <= 0) {
      setError("El tipo de cambio de compra debe ser mayor a 0");
      return;
    }

    if (isNaN(sell) || sell <= 0) {
      setError("El tipo de cambio de venta debe ser mayor a 0");
      return;
    }

    if (sell < buy) {
      setError("El tipo de cambio de venta debe ser mayor o igual al de compra");
      return;
    }

    try {
      setSaving(true);
      await setExchangeRate({
        date,
        buyRate: buy,
        sellRate: sell,
        notes: notes.trim() || undefined,
      });

      setSuccess("Tipo de cambio guardado exitosamente");
      await loadData();

      // Reset form
      const today = new Date().toISOString().split("T")[0];
      setDate(today);
      setBuyRate("");
      setSellRate("");
      setNotes("");
    } catch (err: any) {
      setError(err.message || "Error guardando tipo de cambio");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    // Parse date as local time to avoid timezone conversion issues
    const [year, month, day] = dateStr.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  };

  if (loading) {
    return (
      <main>
        <h1>Configuración de Tipo de Cambio</h1>
        <p>Cargando...</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 30 }}>
        <h1 style={{ marginBottom: 8, fontSize: "1.8rem", fontWeight: 600 }}>💱 Tipo de Cambio USD/CRC</h1>
        <p style={{ color: "#6b7280", margin: 0 }}>Configura el tipo de cambio diario para conversiones de moneda</p>
      </div>

      {/* TC Actual - Card destacada */}
      <section style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        borderRadius: 12,
        padding: 30,
        marginBottom: 30,
        color: "white",
        boxShadow: "0 4px 20px rgba(102, 126, 234, 0.3)"
      }}>
        <h2 style={{ margin: "0 0 20px 0", fontSize: "1.3rem", fontWeight: 600 }}>📊 Tipo de Cambio Vigente</h2>
        {currentRate ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: 16, backdropFilter: "blur(10px)" }}>
              <div style={{ fontSize: "0.85rem", opacity: 0.9, marginBottom: 6 }}>📅 Fecha</div>
              <div style={{ fontSize: "1.3rem", fontWeight: "bold" }}>{formatDate(currentRate.date)}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: 16, backdropFilter: "blur(10px)" }}>
              <div style={{ fontSize: "0.85rem", opacity: 0.9, marginBottom: 6 }}>💰 TC Compra</div>
              <div style={{ fontSize: "1.3rem", fontWeight: "bold" }}>₡{currentRate.buyRate.toFixed(4)}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: 16, backdropFilter: "blur(10px)" }}>
              <div style={{ fontSize: "0.85rem", opacity: 0.9, marginBottom: 6 }}>💵 TC Venta</div>
              <div style={{ fontSize: "1.3rem", fontWeight: "bold" }}>₡{currentRate.sellRate.toFixed(4)}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: 16, backdropFilter: "blur(10px)" }}>
              <div style={{ fontSize: "0.85rem", opacity: 0.9, marginBottom: 6 }}>👤 Configurado por</div>
              <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>{currentRate.setByName}</div>
            </div>
          </div>
        ) : (
          <div style={{ background: "rgba(239, 68, 68, 0.2)", borderRadius: 8, padding: 16, border: "1px solid rgba(239, 68, 68, 0.4)" }}>
            ⚠️ No hay tipo de cambio configurado para hoy
          </div>
        )}
      </section>

      {/* Formulario - Card blanca */}
      <section style={{ background: "white", borderRadius: 12, padding: 30, marginBottom: 30, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <h2 style={{ margin: "0 0 6px 0", fontSize: "1.3rem", fontWeight: 600 }}>✏️ Configurar Tipo de Cambio</h2>
        <p style={{ color: "#6b7280", marginBottom: 24, fontSize: "0.9rem" }}>Establece o actualiza el tipo de cambio para una fecha específica</p>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12, marginBottom: 16, color: "#dc2626" }}>
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: 12, marginBottom: 16, color: "#16a34a" }}>
            ✅ {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20, marginBottom: 20 }}>
            <div className="form-group">
              <label htmlFor="date" style={{ fontWeight: 500, marginBottom: 8, display: "block" }}>📅 Fecha</label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                style={{ width: "100%", padding: "10px 12px", fontSize: "1rem" }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="buyRate" style={{ fontWeight: 500, marginBottom: 8, display: "block" }}>💰 TC Compra (₡)</label>
              <input
                id="buyRate"
                type="number"
                step="0.0001"
                min="0"
                value={buyRate}
                onChange={(e) => setBuyRate(e.target.value)}
                placeholder="520.5000"
                required
                style={{ width: "100%", padding: "10px 12px", fontSize: "1rem" }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="sellRate" style={{ fontWeight: 500, marginBottom: 8, display: "block" }}>💵 TC Venta (₡)</label>
              <input
                id="sellRate"
                type="number"
                step="0.0001"
                min="0"
                value={sellRate}
                onChange={(e) => setSellRate(e.target.value)}
                placeholder="530.2500"
                required
                style={{ width: "100%", padding: "10px 12px", fontSize: "1rem" }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 24 }}>
            <label htmlFor="notes" style={{ fontWeight: 500, marginBottom: 8, display: "block" }}>📝 Notas (opcional)</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ejemplo: Fuente: BCCR, actualizado manualmente"
              rows={3}
              style={{ width: "100%", padding: "10px 12px", fontSize: "1rem", resize: "vertical" }}
            />
          </div>

          <button 
            type="submit" 
            className="btn" 
            disabled={saving}
            style={{ 
              padding: "12px 32px", 
              fontSize: "1rem",
              background: saving ? "#9ca3af" : undefined,
              cursor: saving ? "not-allowed" : "pointer"
            }}
          >
            {saving ? "⏳ Guardando..." : "💾 Guardar Tipo de Cambio"}
          </button>
        </form>
      </section>

      {/* Historial - Card blanca */}
      <section style={{ background: "white", borderRadius: 12, padding: 30, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <h2 style={{ margin: "0 0 6px 0", fontSize: "1.3rem", fontWeight: 600 }}>📜 Historial de Tipos de Cambio</h2>
        <p style={{ color: "#6b7280", marginBottom: 20, fontSize: "0.9rem" }}>Últimos 30 días configurados</p>

        {history.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>📊</div>
            <p style={{ margin: 0 }}>No hay historial de tipos de cambio</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>TC Compra</th>
                  <th>TC Venta</th>
                  <th>Configurado por</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {history.map((rate) => (
                  <tr key={rate.id}>
                    <td>{formatDate(rate.date)}</td>
                    <td style={{ color: "#10b981", fontWeight: "bold" }}>
                      ₡{rate.buyRate.toFixed(4)}
                    </td>
                    <td style={{ color: "#3b82f6", fontWeight: "bold" }}>
                      ₡{rate.sellRate.toFixed(4)}
                    </td>
                    <td>{rate.setByName}</td>
                    <td style={{ fontSize: "0.9rem", color: "#6b7280" }}>{rate.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
