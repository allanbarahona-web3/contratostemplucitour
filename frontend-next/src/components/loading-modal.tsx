"use client";

import { useEffect } from "react";

type LoadingModalState = "loading" | "success" | "error";

interface LoadingModalProps {
  isOpen: boolean;
  state: LoadingModalState;
  loadingMessage?: string;
  successMessage?: string;
  errorMessage?: string;
  onClose?: () => void;
  autoCloseDelay?: number; // milisegundos
}

export function LoadingModal({
  isOpen,
  state,
  loadingMessage = "Procesando...",
  successMessage = "¡Completado!",
  errorMessage = "Error",
  onClose,
  autoCloseDelay = 1500,
}: LoadingModalProps) {
  // Auto-cerrar en success después del delay
  useEffect(() => {
    if (state === "success" && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [state, onClose, autoCloseDelay]);

  if (!isOpen) return null;

  return (
    <div className="loading-modal-overlay">
      <div className="loading-modal-content">
        {/* Loading State */}
        {state === "loading" && (
          <div className="loading-modal-state">
            <div className="loading-modal-spinner">
              <div className="spinner-circle"></div>
            </div>
            <p className="loading-modal-message">{loadingMessage}</p>
          </div>
        )}

        {/* Success State */}
        {state === "success" && (
          <div className="loading-modal-state loading-modal-success">
            <div className="loading-modal-icon success-icon">
              <svg viewBox="0 0 52 52" className="success-checkmark">
                <circle className="success-checkmark-circle" cx="26" cy="26" r="25" fill="none" />
                <path className="success-checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
              </svg>
            </div>
            <p className="loading-modal-message success-message">{successMessage}</p>
          </div>
        )}

        {/* Error State */}
        {state === "error" && (
          <div className="loading-modal-state loading-modal-error">
            <div className="loading-modal-icon error-icon">
              <svg viewBox="0 0 52 52" className="error-cross">
                <circle className="error-cross-circle" cx="26" cy="26" r="25" fill="none" />
                <path className="error-cross-line" fill="none" d="M16 16 36 36 M36 16 16 36" />
              </svg>
            </div>
            <p className="loading-modal-message error-message">{errorMessage}</p>
            {onClose && (
              <button className="loading-modal-close-btn" onClick={onClose}>
                Cerrar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
