"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { confirmPasswordReset } from "@/lib/auth-api";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setError("");

    if (!token) {
      setError("Token inválido. Por favor solicita un nuevo enlace de reseteo.");
      return;
    }

    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setError("La contraseña debe incluir al menos una letra mayúscula");
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/`~]/.test(newPassword)) {
      setError("La contraseña debe incluir al menos un carácter especial (!@#$%&*...)");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      const result = await confirmPasswordReset(token, newPassword);
      setSuccess(true);
      setTimeout(() => {
        router.push("/");
      }, 3000);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "No se pudo resetear la contraseña.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <main className="shell">
        <section className="login-card">
          <h1 className="login-title">Token Inválido</h1>
          <p className="login-error">El enlace de reseteo es inválido o ha expirado.</p>
          <button type="button" className="btn" onClick={() => router.push("/")}>
            Volver al inicio
          </button>
        </section>
      </main>
    );
  }

  if (success) {
    return (
      <main className="shell">
        <section className="login-card">
          <h1 className="login-title">✓ Contraseña Actualizada</h1>
          <p style={{ textAlign: "center", color: "#059669" }}>
            Tu contraseña ha sido actualizada correctamente. Serás redirigido al inicio de sesión...
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="login-card">
        <Image
          src="/assets/LOGO ALMANOVA NEGRO CON DORADO.png"
          alt="Viajes Alma Nova"
          width={245}
          height={120}
          className="login-logo"
          style={{ width: "clamp(170px, 42vw, 245px)", height: "auto" }}
          priority
        />

        <h1 className="login-title">Nueva Contraseña</h1>
        <p className="login-subtitle">Ingresa tu nueva contraseña.</p>

        <form className="login-form" onSubmit={onSubmit}>
          <label>
            Nueva contraseña
            <input
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
            />
            <p style={{ 
              fontSize: "0.85rem", 
              color: "#6b7280", 
              marginTop: "6px",
              marginBottom: "0",
              lineHeight: "1.4"
            }}>
              • Mínimo 8 caracteres • Una mayúscula • Un carácter especial (!@#$%&*...)
            </p>
          </label>

          <label>
            Confirmar contraseña
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={8}
              placeholder="Repite la contraseña"
            />
          </label>

          <div style={{ marginTop: "8px", marginBottom: "8px" }}>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                style={{ marginRight: "8px" }}
              />
              <span style={{ fontSize: "0.9rem" }}>Mostrar contraseñas</span>
            </label>
          </div>

          {error ? <p className="login-error">{error}</p> : null}

          <button type="submit" disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar contraseña"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="btn btn-secondary"
            style={{ marginTop: "12px" }}
          >
            Cancelar
          </button>
        </form>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="shell">
          <section className="login-card">
            <p>Cargando...</p>
          </section>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
