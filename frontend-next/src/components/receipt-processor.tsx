import { useState, useRef, useEffect } from "react";
import { processReceipt, type ExtractedPaymentData } from "@/lib/payment-verification-api";

interface ReceiptProcessorProps {
  onDataExtracted: (data: ExtractedPaymentData) => void;
  onFileSelected?: (file: File) => void;
  onError?: (error: string) => void;
}

export function ReceiptProcessor({ onDataExtracted, onFileSelected, onError }: ReceiptProcessorProps) {
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [showZoom, setShowZoom] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cerrar zoom con ESC y prevenir scroll del body
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showZoom) {
        setShowZoom(false);
      }
    };
    
    if (showZoom) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [showZoom]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      onError?.("Solo se permiten imágenes (JPG, PNG, WEBP)");
      return;
    }

    // Validar tamaño (10MB)
    if (file.size > 10 * 1024 * 1024) {
      onError?.("El archivo es demasiado grande. Máximo 10MB");
      return;
    }

    setFileName(file.name);

    // Notificar al padre que se seleccionó un archivo
    onFileSelected?.(file);

    // Crear preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Procesar con Vision AI
    try {
      setProcessing(true);
      const result = await processReceipt(file);

      // Mostrar warnings si hay
      if (result.warnings && result.warnings.length > 0) {
        console.warn("Advertencias al procesar comprobante:", result.warnings);
      }

      // Pasar datos extraídos al componente padre
      onDataExtracted(result.extractedData);

    } catch (err: any) {
      console.error("Error procesando comprobante:", err);
      onError?.(err.message || "Error procesando comprobante");
      setPreview(null);
      setFileName("");
    } finally {
      setProcessing(false);
    }
  };

  const handleClear = () => {
    setPreview(null);
    setFileName("");
    onFileSelected?.(undefined as any); // Notificar que se quitó el archivo
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div style={{ 
      border: "2px dashed #cbd5e1", 
      borderRadius: 8, 
      padding: 10, 
      marginBottom: 8,
      background: "#f8fafc"
    }}>
      <div style={{ marginBottom: 8 }}>
        <strong style={{ fontSize: "0.85rem" }}>📎 Adjuntar comprobante (Opcional)</strong>
        <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "2px 0 0 0" }}>
          IA extraerá los datos automáticamente
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileSelect}
        disabled={processing}
        style={{ 
          marginBottom: 8, 
          fontSize: "0.8rem",
          display: preview ? "none" : "block" // Ocultar cuando hay preview
        }}
      />

      {processing && (
        <div style={{ 
          padding: 8, 
          background: "#dbeafe", 
          borderRadius: 6, 
          color: "#1e40af",
          fontSize: "0.8rem"
        }}>
          ⏳ Procesando... 
        </div>
      )}

      {preview && !processing && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: "0.8rem", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              ✅ {fileName}
            </span>
            <button
              type="button"
              onClick={handleClear}
              style={{
                padding: "3px 8px",
                fontSize: "0.75rem",
                background: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                flexShrink: 0
              }}
            >
              Quitar
            </button>
          </div>
          <div style={{ 
            position: "relative",
            maxHeight: "450px",
            overflowY: "auto",
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            background: "#fff",
            cursor: "zoom-in"
          }}
            onClick={() => setShowZoom(true)}
            title="Clic para ampliar"
          >
            <img 
              src={preview} 
              alt="Preview" 
              style={{ 
                width: "100%", 
                height: "auto",
                display: "block"
              }} 
            />
            <div style={{
              position: "sticky",
              bottom: 8,
              left: 8,
              right: 8,
              textAlign: "center",
              marginTop: -40,
              pointerEvents: "none"
            }}>
              <span style={{
                display: "inline-block",
                background: "rgba(0,0,0,0.75)",
                color: "white",
                padding: "6px 12px",
                borderRadius: 6,
                fontSize: "0.75rem",
                fontWeight: "600",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
              }}>
                🔍 Clic para ampliar
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal de zoom */}
      {showZoom && preview && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.92)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => setShowZoom(false)}
        >
          <div style={{ position: "relative", maxWidth: "95vw", maxHeight: "80vh" }}>
            <img 
              src={preview} 
              alt="Comprobante ampliado"
              style={{ 
                maxWidth: "100%",
                maxHeight: "80vh",
                objectFit: "contain",
                borderRadius: 8,
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)"
              }}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowZoom(false);
              }}
              style={{
                position: "absolute",
                top: -40,
                right: 0,
                background: "white",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: "0.9rem",
                fontWeight: "600",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
              }}
            >
              ✕ Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
