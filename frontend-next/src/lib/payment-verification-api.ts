import { authenticatedFetch, getStoredToken } from "@/lib/auth-api";
import { resolveApiBase } from "@/lib/runtime-config";

export type ExtractedPaymentData = {
  amount?: number;
  currency?: string;
  date?: string;
  reference?: string;
  originBank?: string;
  destinationBank?: string;
  destinationAccount?: string;
  payerName?: string;
  paymentCode?: string;
  notes?: string;
  confidence?: number;
  rawExtractedData?: any;
  // Campos de conversión automática
  originalAmount?: number;
  originalCurrency?: string;
  conversionApplied?: boolean;
  usedExchangeRate?: number | null;
};

export type ProcessReceiptResult = {
  receiptId: string;
  extractedData: ExtractedPaymentData;
  warnings: string[];
};

/**
 * Procesar un comprobante de pago con Vision AI
 */
export async function processReceipt(
  file: File
): Promise<ProcessReceiptResult> {
  const token = getStoredToken();
  const base = await resolveApiBase();

  const formData = new FormData();
  formData.append("receipt", file);

  const res = await authenticatedFetch(`${base}/payment-verification/process-receipt`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Error ${res.status}`);
  }

  return res.json();
}

/**
 * Obtener un comprobante procesado por ID
 */
export async function getReceiptById(id: string): Promise<any> {
  const token = getStoredToken();
  const base = await resolveApiBase();

  const res = await authenticatedFetch(`${base}/payment-verification/receipts/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Error ${res.status}: ${await res.text()}`);
  }

  return res.json();
}
