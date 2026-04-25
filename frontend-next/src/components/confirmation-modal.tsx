"use client";

type ConfirmationModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
};

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  confirmVariant = "primary",
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <section
      className="viewer-modal confirmation-modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isLoading) {
          onCancel();
        }
      }}
    >
      <div className="viewer-panel confirmation-modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="confirmation-modal-head">
          <h2>{title}</h2>
          {!isLoading && (
            <button type="button" className="btn btn-secondary" onClick={onCancel} aria-label="Cerrar">
              ✕
            </button>
          )}
        </div>

        <div className="confirmation-modal-body">
          <p>{message}</p>
        </div>

        <div className="confirmation-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={confirmVariant === "danger" ? "btn btn-danger" : "btn"}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
