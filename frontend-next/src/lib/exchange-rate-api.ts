import { authenticatedFetch, getStoredToken } from "@/lib/auth-api";
import { resolveApiBase } from "@/lib/runtime-config";

export type ExchangeRate = {
  id: string;
  date: string;
  buyRate: number;
  sellRate: number;
  source: string;
  setByName: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SetExchangeRateInput = {
  date: string; // YYYY-MM-DD
  buyRate: number;
  sellRate: number;
  notes?: string;
};

/**
 * Get current exchange rate (today's rate)
 */
export async function getCurrentExchangeRate(): Promise<ExchangeRate | null> {
  const token = getStoredToken();
  const base = await resolveApiBase();

  const res = await authenticatedFetch(`${base}/exchange-rate/current`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.rate || null;
}

/**
 * Get exchange rate for a specific date
 */
export async function getExchangeRateByDate(date: string): Promise<ExchangeRate | null> {
  const token = getStoredToken();
  const base = await resolveApiBase();

  const res = await authenticatedFetch(`${base}/exchange-rate?date=${encodeURIComponent(date)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.rate || null;
}

/**
 * Get exchange rate history
 */
export async function getExchangeRateHistory(days = 30): Promise<ExchangeRate[]> {
  const token = getStoredToken();
  const base = await resolveApiBase();

  const res = await authenticatedFetch(`${base}/exchange-rate/history?days=${days}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.rates || [];
}

/**
 * Set exchange rate for a specific date (admin only)
 */
export async function setExchangeRate(input: SetExchangeRateInput): Promise<ExchangeRate> {
  const token = getStoredToken();
  const base = await resolveApiBase();

  const res = await authenticatedFetch(`${base}/exchange-rate/set`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(`Error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.rate;
}

/**
 * Get exchange rate history for a specific date range
 */
export async function getExchangeRateHistoryRange(
  startDate: string,
  endDate: string
): Promise<ExchangeRate[]> {
  const token = getStoredToken();
  const base = await resolveApiBase();

  const res = await authenticatedFetch(
    `${base}/exchange-rate/history-range?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.rates || [];
}

/**
 * Download exchange rate history as PDF
 */
export async function downloadExchangeRateHistoryPdf(
  startDate: string,
  endDate: string
): Promise<Blob> {
  const token = getStoredToken();
  const base = await resolveApiBase();

  const res = await authenticatedFetch(
    `${base}/exchange-rate/export-pdf?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Error ${res.status}: ${await res.text()}`);
  }

  return await res.blob();
}

/**
 * Send exchange rate history via email
 */
export async function emailExchangeRateHistory(
  startDate: string,
  endDate: string,
  email: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const token = getStoredToken();
  const base = await resolveApiBase();

  const res = await authenticatedFetch(`${base}/exchange-rate/email-history`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ startDate, endDate, email }),
  });

  if (!res.ok) {
    throw new Error(`Error ${res.status}: ${await res.text()}`);
  }

  return await res.json();
}

