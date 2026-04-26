"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getStoredSession, getStoredToken, loginWithEmailPassword, requestPasswordReset } from "@/lib/auth-api";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState(""); // Honeypot field
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");

  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      router.replace("/contracts");
    }
  }, [router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    // Check honeypot - if filled, it's a bot
    if (website.trim()) {
      setError("Solicitud inválida");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await loginWithEmailPassword(email, password);
      
      // Check if user must change password
      const session = getStoredSession();
      if (session?.user?.mustChangePassword) {
        router.push("/change-password");
      } else {
        router.push("/contracts");
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "No se pudo iniciar sesion.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const onRequestReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (resetLoading) return;

    setResetError("");
    setResetMessage("");
    setResetLoading(true);
    try {
      const result = await requestPasswordReset(resetEmail);
      setResetMessage(result.message);
      setResetEmail("");
      
      // Cerrar modal automáticamente después de 2 segundos
      setTimeout(() => {
        setShowResetModal(false);
        setResetMessage("");
        setResetError("");
      }, 2000);
    } catch (resetError) {
      const message = resetError instanceof Error ? resetError.message : "No se pudo procesar la solicitud.";
      setResetError(message);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <main className="shell">
      <section className="login-card">
        <Image
          src="/assets/LOGO ALMANOVA.png"
          alt="Viajes Alma Nova"
          width={245}
          height={120}
          className="login-logo"
          style={{ width: "clamp(170px, 42vw, 245px)", height: "auto" }}
          priority
        />

        <h1 className="login-title">Ingreso de Agente</h1>
        <p className="login-subtitle">Primera pantalla migrada a Next.js + TypeScript.</p>

        <form className="login-form" onSubmit={onSubmit}>
          {/* Honeypot field - hidden from users but visible to bots */}
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px" }}
            tabIndex={-1}
            autoComplete="nope"
            aria-hidden="true"
          />

          <label>
            Correo
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Contrasena
          </label>
          <div style={{ position: "relative", width: "100%" }}>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              style={{ paddingRight: "45px", width: "100%" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "1.3rem",
                padding: "0",
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "30px",
                height: "30px",
              }}
              title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          <div style={{ textAlign: "right", marginTop: "8px", marginBottom: "8px" }}>
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              style={{
                background: "none",
                border: "none",
                color: "#0066cc",
                textDecoration: "underline",
                cursor: "pointer",
                fontSize: "0.9rem",
                padding: "0",
              }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {error ? <p className="login-error">{error}</p> : null}

          <button type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Entrar"}
          </button>
        </form>

        {/* Modal de Reset de Contraseña */}
        {showResetModal ? (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              animation: "fadeIn 0.2s ease-out",
            }}
            onClick={() => {
              if (!resetLoading) {
                setShowResetModal(false);
                setResetError("");
                setResetMessage("");
              }
            }}
          >
            <div
              style={{
                background: "white",
                borderRadius: "16px",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                maxWidth: "480px",
                width: "90%",
                padding: "0",
                position: "relative",
                overflow: "hidden",
                animation: "slideUp 0.3s ease-out",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header con gradiente */}
              <div
                style={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  padding: "32px 32px 24px 32px",
                  color: "white",
                  position: "relative",
                }}
              >
                <button
                  onClick={() => {
                    if (!resetLoading) {
                      setShowResetModal(false);
                      setResetError("");
                      setResetMessage("");
                    }
                  }}
                  disabled={resetLoading}
                  style={{
                    position: "absolute",
                    top: "16px",
                    right: "16px",
                    background: "rgba(255, 255, 255, 0.2)",
                    border: "none",
                    borderRadius: "50%",
                    width: "32px",
                    height: "32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: resetLoading ? "not-allowed" : "pointer",
                    fontSize: "1.5rem",
                    color: "white",
                    transition: "background 0.2s",
                    opacity: resetLoading ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!resetLoading) {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                  }}
                  aria-label="Cerrar"
                >
                  ×
                </button>

                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    background: "rgba(255, 255, 255, 0.2)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.8rem",
                    marginBottom: "16px",
                  }}
                >
                  🔑
                </div>

                <h2 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>
                  Recuperar Contraseña
                </h2>
                <p style={{ margin: "8px 0 0 0", opacity: 0.95, fontSize: "0.95rem", lineHeight: 1.5 }}>
                  Te enviaremos un enlace seguro para que puedas restablecer tu contraseña.
                </p>
              </div>

              {/* Contenido del formulario */}
              <form onSubmit={onRequestReset} style={{ padding: "32px" }}>
                <label style={{ display: "block", marginBottom: "24px" }}>
                  <span
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      color: "#374151",
                      fontWeight: 600,
                      fontSize: "0.95rem",
                    }}
                  >
                    📧 Correo electrónico
                  </span>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    disabled={resetLoading}
                    placeholder="tu@email.com"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      fontSize: "1rem",
                      border: "2px solid #e5e7eb",
                      borderRadius: "10px",
                      transition: "all 0.2s",
                      outline: "none",
                      opacity: resetLoading ? 0.6 : 1,
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#667eea";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#e5e7eb";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </label>

                {resetError && (
                  <div
                    style={{
                      marginBottom: "20px",
                      padding: "14px 16px",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: "10px",
                      color: "#991b1b",
                      fontSize: "0.9rem",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      animation: "shakeError 0.4s ease-in-out",
                    }}
                  >
                    <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>⚠️</span>
                    <span>{resetError}</span>
                  </div>
                )}

                {resetMessage && (
                  <div
                    style={{
                      marginBottom: "20px",
                      padding: "14px 16px",
                      background: "#f0fdf4",
                      border: "1px solid #86efac",
                      borderRadius: "10px",
                      color: "#166534",
                      fontSize: "0.9rem",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      animation: "slideDown 0.3s ease-out",
                    }}
                  >
                    <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>✅</span>
                    <div>
                      <strong style={{ display: "block", marginBottom: "4px" }}>¡Enviado con éxito!</strong>
                      <span>{resetMessage}</span>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetModal(false);
                      setResetError("");
                      setResetMessage("");
                    }}
                    disabled={resetLoading}
                    style={{
                      flex: 1,
                      padding: "12px 20px",
                      fontSize: "1rem",
                      fontWeight: 600,
                      border: "2px solid #e5e7eb",
                      borderRadius: "10px",
                      background: "white",
                      color: "#6b7280",
                      cursor: resetLoading ? "not-allowed" : "pointer",
                      transition: "all 0.2s",
                      opacity: resetLoading ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!resetLoading) {
                        e.currentTarget.style.background = "#f9fafb";
                        e.currentTarget.style.borderColor = "#d1d5db";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "white";
                      e.currentTarget.style.borderColor = "#e5e7eb";
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading || !!resetMessage}
                    style={{
                      flex: 1,
                      padding: "12px 20px",
                      fontSize: "1rem",
                      fontWeight: 600,
                      border: "none",
                      borderRadius: "10px",
                      background: resetLoading || resetMessage
                        ? "#d1d5db"
                        : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      color: "white",
                      cursor: resetLoading || resetMessage ? "not-allowed" : "pointer",
                      transition: "all 0.2s",
                      boxShadow: resetLoading || resetMessage
                        ? "none"
                        : "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                    }}
                    onMouseEnter={(e) => {
                      if (!resetLoading && !resetMessage) {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow =
                          "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow =
                        "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)";
                    }}
                  >
                    {resetLoading ? "⏳ Enviando..." : resetMessage ? "✓ Enviado" : "📤 Enviar enlace"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
