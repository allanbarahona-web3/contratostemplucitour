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
    <main className="min-h-screen grid place-items-center p-5">
      <section className="w-full max-w-[460px] bg-white/75 border border-blue-900/10 rounded-[26px] p-7 backdrop-blur-[14px] shadow-[0_28px_55px_rgba(15,31,58,0.12),0_2px_0_rgba(255,255,255,0.65)_inset]">
        <Image
          src="/assets/LOGO ALMANOVA.png"
          alt="Viajes Alma Nova"
          width={245}
          height={120}
          className="h-auto block mx-auto mb-2.5"
          style={{ width: "clamp(170px, 42vw, 245px)" }}
          priority
        />

        <h1 className="m-0 mb-2.5 text-2xl text-center">Ingreso de Agente</h1>
        <p className="mt-2 mb-4 text-gray-600 text-center text-sm">Primera pantalla migrada a Next.js + TypeScript.</p>

        <form className="grid gap-2.5" onSubmit={onSubmit}>
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

          <label className="grid gap-1.5 text-sm font-bold text-blue-900">
            Correo
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="border border-blue-900/20 bg-white/90 px-3.5 py-3 rounded-[14px] transition-all duration-150 focus:outline-none focus:border-blue-700/85 focus:shadow-[0_0_0_4px_rgba(23,78,166,0.16)]"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-bold text-blue-900">
            Contraseña
            <div className="relative w-full">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="w-full border border-blue-900/20 bg-white/90 px-3.5 py-3 pr-11 rounded-[14px] transition-all duration-150 focus:outline-none focus:border-blue-700/85 focus:shadow-[0_0_0_4px_rgba(23,78,166,0.16)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-[1.3rem] p-0 leading-none flex items-center justify-center w-[30px] h-[30px]"
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </label>

          <div className="text-right mt-2 mb-2">
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="bg-transparent border-none text-blue-600 underline cursor-pointer text-sm p-0"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {error ? <p className="my-0.5 text-sm text-red-600 font-bold">{error}</p> : null}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full rounded-xl px-4 py-3 bg-gradient-to-b from-blue-500 to-blue-700 text-white font-bold shadow-lg shadow-blue-500/25 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/30 active:translate-y-0 active:saturate-75 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg"
          >
            {loading ? "Ingresando..." : "Entrar"}
          </button>
        </form>

        {/* Modal de Reset de Contraseña */}
        {showResetModal ? (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] animate-fadeIn"
            onClick={() => {
              if (!resetLoading) {
                setShowResetModal(false);
                setResetError("");
                setResetMessage("");
              }
            }}
          >
            <div
              className="bg-white rounded-2xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)] max-w-[480px] w-[90%] relative overflow-hidden animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header con gradiente */}
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-8 pb-6 text-white relative">
                <button
                  onClick={() => {
                    if (!resetLoading) {
                      setShowResetModal(false);
                      setResetError("");
                      setResetMessage("");
                    }
                  }}
                  disabled={resetLoading}
                  className="absolute top-4 right-4 bg-white/20 border-none rounded-full w-8 h-8 flex items-center justify-center cursor-pointer text-2xl text-white transition-all duration-200 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Cerrar"
                >
                  ×
                </button>

                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-3xl mb-4">
                  🔑
                </div>

                <h2 className="m-0 text-[1.75rem] font-bold">
                  Recuperar Contraseña
                </h2>
                <p className="mt-2 mb-0 opacity-95 text-[0.95rem] leading-relaxed">
                  Te enviaremos un enlace seguro para que puedas restablecer tu contraseña.
                </p>
              </div>

              {/* Contenido del formulario */}
              <form onSubmit={onRequestReset} className="p-8">
                <label className="block mb-6">
                  <span className="block mb-2 text-gray-700 font-semibold text-[0.95rem]">
                    📧 Correo electrónico
                  </span>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    disabled={resetLoading}
                    placeholder="tu@email.com"
                    className="w-full px-4 py-3 text-base border-2 border-gray-200 rounded-[10px] transition-all outline-none disabled:opacity-60 focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(102,126,234,0.1)]"
                  />
                </label>

                {resetError && (
                  <div className="mb-5 p-3.5 px-4 bg-red-50 border border-red-200 rounded-[10px] text-red-800 text-sm flex items-start gap-2.5 animate-shakeError">
                    <span className="text-xl flex-shrink-0">⚠️</span>
                    <span>{resetError}</span>
                  </div>
                )}

                {resetMessage && (
                  <div className="mb-5 p-3.5 px-4 bg-green-50 border border-green-300 rounded-[10px] text-green-800 text-sm flex items-start gap-2.5 animate-slideDown">
                    <span className="text-xl flex-shrink-0">✅</span>
                    <div>
                      <strong className="block mb-1">¡Enviado con éxito!</strong>
                      <span>{resetMessage}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetModal(false);
                      setResetError("");
                      setResetMessage("");
                    }}
                    disabled={resetLoading}
                    className="flex-1 px-5 py-3 text-base font-semibold border-2 border-gray-200 rounded-[10px] bg-white text-gray-600 transition-all duration-200 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading || !!resetMessage}
                    className="flex-1 px-5 py-3 text-base font-semibold border-none rounded-[10px] bg-gradient-to-br from-indigo-500 to-purple-600 text-white transition-all duration-200 shadow-md hover:-translate-y-px hover:shadow-lg disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-y-0"
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
