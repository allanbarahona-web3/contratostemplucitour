import { useState, useRef } from "react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      padding: 20, 
      marginBottom: 20,
      background: "#f8fafc"
    }}>
      <div style={{ marginBottom: 12 }}>
        <strong>📎 Adjuntar comprobante (Opcional)</strong>
        <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "4px 0 0 0" }}>
          El sistema extraerá automáticamente los datos del comprobante con IA
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileSelect}
        disabled={processing}
        style={{ marginBottom: 12 }}
      />

      {processing && (
        <div style={{ 
          padding: 12, 
          background: "#dbeafe", 
          borderRadius: 6, 
          color: "#1e40af",
          fontSize: "0.9rem"
        }}>
          ⏳ Procesando comprobante con IA... esto puede tardar unos segundos
        </div>
      )}

      {preview && !processing && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: "0.9rem", color: "#475569" }}>
              ✅ <strong>{fileName}</strong>
            </span>
            <button
              type="button"
              onClick={handleClear}
              style={{
                padding: "4px 12px",
                fontSize: "0.85rem",
                background: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              🗑️ Quitar
            </button>
          </div>
          <div style={{ 
            maxHeight: "calc(80vh - 200px)",
            overflowY: "auto",
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            background: "#f8fafc"
          }}>
            <img 
              src={preview} 
              alt="Preview" 
              style={{ 
                width: "100%", 
                height: "auto",
                display: "block"
              }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
