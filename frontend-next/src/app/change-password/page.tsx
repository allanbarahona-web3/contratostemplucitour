"use client";

import { changePassword, clearStoredToken, getStoredSession } from "@/lib/auth-api";
import { ToastNotification, useToast } from "@/components/toast-notification";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const session = getStoredSession();
  const { toasts, showSuccess, showError, dismissToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // If user not logged in, redirect to login
    if (!session?.user?.id) {
      router.replace("/");
      return;
    }

    // If user doesn't need to change password, redirect to appropriate page
    if (!session.user.mustChangePassword) {
      const role = String(session.user.role || "").toUpperCase();
      if (role === "ADMIN") {
        router.replace("/admin/users");
      } else if (role === "CONTADOR" || role === "FACTURACION_COBROS") {
        router.replace("/billing/admin/reports");
      } else {
        router.replace("/contracts");
      }
    }
  }, [session, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      showError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      showError("La contraseña debe incluir al menos una letra mayúscula");
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/`~]/.test(newPassword)) {
      showError("La contraseña debe incluir al menos un carácter especial (!@#$%&*...)");
      return;
    }

    if (newPassword !== confirmPassword) {
      showError("Las contraseñas no coinciden");
      return;
    }

    if (newPassword === currentPassword) {
      showError("La nueva contraseña debe ser diferente a la actual");
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      showSuccess("Contraseña actualizada correctamente. Redirigiendo...");
      
      // Wait a moment for user to see the success message
      setTimeout(() => {
        // Clear session and redirect to login
        clearStoredToken();
        router.replace("/");
      }, 2000);
    } catch (error) {
      showError(error instanceof Error ? error.message : "No se pudo cambiar la contraseña");
      setSaving(false);
    }
  };

  // Don't show page if conditions aren't met
  if (!session?.user?.id || !session.user.mustChangePassword) {
    return null;
  }

  return (
    <main className="shell">
      <section className="card" style={{ maxWidth: "500px", width: "90%" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "24px",
            color: "white",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              background: "rgba(255, 255, 255, 0.2)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem",
              marginBottom: "12px",
            }}
          >
            🔐
          </div>
          <h1 style={{ margin: "0 0 8px 0", fontSize: "1.5rem", fontWeight: 700 }}>
            Cambio de Contraseña Obligatorio
          </h1>
          <p style={{ margin: 0, opacity: 0.95, fontSize: "0.95rem", lineHeight: 1.5 }}>
            Por seguridad, debes actualizar tu contraseña antes de continuar.
          </p>
        </div>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: 600, color: "#374151" }}>
              Contraseña Actual
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              disabled={saving}
              placeholder="Tu contraseña temporal"
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: "1rem",
                border: "2px solid #e5e7eb",
                borderRadius: "10px",
                transition: "all 0.2s",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: 600, color: "#374151" }}>
              Nueva Contraseña
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={saving}
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: "1rem",
                border: "2px solid #e5e7eb",
                borderRadius: "10px",
                transition: "all 0.2s",
                outline: "none",
              }}
            />
            <p style={{ 
              fontSize: "0.85rem", 
              color: "#6b7280", 
              marginTop: "6px",
              lineHeight: "1.4"
            }}>
              • Mínimo 8 caracteres • Una mayúscula • Un carácter especial (!@#$%&*...)
            </p>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: 600, color: "#374151" }}>
              Confirmar Nueva Contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={saving}
              placeholder="Repite la nueva contraseña"
              minLength={8}
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: "1rem",
                border: "2px solid #e5e7eb",
                borderRadius: "10px",
                transition: "all 0.2s",
                outline: "none",
              }}
            />
          </div>

          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #3b82f6",
              borderRadius: "10px",
              padding: "14px 16px",
              marginBottom: "24px",
            }}
          >
            <div style={{ display: "flex", gap: "10px" }}>
              <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>💡</span>
              <div style={{ fontSize: "0.85rem", color: "#1e40af", lineHeight: 1.5 }}>
                <strong>Recomendaciones:</strong>
                <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
                  <li>Usa al menos 8 caracteres</li>
                  <li>Combina letras, números y símbolos</li>
                  <li>Evita datos personales obvios</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              width: "100%",
              padding: "14px 20px",
              fontSize: "1.05rem",
              fontWeight: 600,
              border: "none",
              borderRadius: "10px",
              background: saving
                ? "#d1d5db"
                : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "white",
              cursor: saving ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              boxShadow: saving
                ? "none"
                : "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            }}
          >
            {saving ? "⏳ Actualizando..." : "✓ Cambiar Contraseña"}
          </button>
        </form>
      </section>

      <ToastNotification toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}
