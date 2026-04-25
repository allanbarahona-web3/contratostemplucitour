export interface ProcessReceiptDto {
  // La imagen viene como file upload, no necesita DTO de validación aquí
  // Se valida en el controller con interceptor
}

export interface ExtractedPaymentData {
  amount?: number;
  currency?: string;  // CRC, USD
  date?: string;      // ISO date string
  reference?: string; // Referencia bancaria
  originBank?: string;
  destinationBank?: string;
  destinationAccount?: string; // IBAN o número de cuenta
  payerName?: string;
  paymentCode?: string; // Código único extraído del detalle
  notes?: string;      // Resto del detalle
  confidenceScore?: number; // 0-1
  rawExtractedData?: any;   // JSON original de OpenAI
  // Campos de conversión automática
  originalAmount?: number;      // Monto original antes de conversión
  originalCurrency?: string;    // Moneda original (CRC/USD)
  conversionApplied?: boolean;  // Si se aplicó conversión CRC→USD
  usedExchangeRate?: number | null; // TC usado para conversión
}
