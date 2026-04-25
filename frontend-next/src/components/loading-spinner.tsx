"use client";

type LoadingSpinnerProps = {
  size?: "small" | "medium" | "large";
  message?: string;
};

export function LoadingSpinner({ size = "medium", message }: LoadingSpinnerProps) {
  return (
    <div className="loading-spinner-container">
      <div className={`loading-spinner loading-spinner-${size}`}>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
      </div>
      {message && <p className="loading-spinner-message">{message}</p>}
    </div>
  );
}

export function PageLoader({ message = "Cargando..." }: { message?: string }) {
  return (
    <div className="page-loader">
      <LoadingSpinner size="large" message={message} />
    </div>
  );
}

export function InlineLoader({ message }: { message?: string }) {
  return (
    <div className="inline-loader">
      <LoadingSpinner size="small" message={message} />
    </div>
  );
}
