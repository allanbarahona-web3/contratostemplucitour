"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getStoredToken, loginWithEmailPassword } from "@/lib/auth-api";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      router.replace("/contracts");
    }
  }, [router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);
    try {
      await loginWithEmailPassword(email, password);
      router.push("/contracts");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "No se pudo iniciar sesion.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

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

        <h1 className="login-title">Ingreso de Agente</h1>
        <p className="login-subtitle">Primera pantalla migrada a Next.js + TypeScript.</p>

        <form className="login-form" onSubmit={onSubmit}>
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

          {error ? <p className="login-error">{error}</p> : null}

          <button type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
