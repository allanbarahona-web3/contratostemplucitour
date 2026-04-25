import { authenticatedFetch, getStoredToken } from "@/lib/auth-api";
import { resolveApiBase } from "@/lib/runtime-config";

export type CompanyBankAccount = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountType: string;
  currency: string;
  sinpeNumber?: string | null;
  accountHolderName: string;
  companyName?: string | null;
  isActive: boolean;
  notes?: string | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    payments: number;
  };
};

export type CreateBankAccountInput = {
  bankName: string;
  accountNumber: string;
  accountType: "CUENTA_CORRIENTE" | "CUENTA_AHORRO";
  currency: "CRC" | "USD";
  sinpeNumber?: string;
  accountHolderName: string;
  companyName?: string;
  isActive?: boolean;
  notes?: string;
};

export type UpdateBankAccountInput = Partial<CreateBankAccountInput>;

/**
 * Obtener todas las cuentas bancarias
 */
export async function getAllBankAccounts(filters?: {
  bankName?: string;
  currency?: string;
  isActive?: "true" | "false" | "all";
}): Promise<CompanyBankAccount[]> {
  const token = getStoredToken();
  const base = await resolveApiBase();

  const params = new URLSearchParams();
  if (filters?.bankName) params.append("bankName", filters.bankName);
  if (filters?.currency) params.append("currency", filters.currency);
  if (filters?.isActive) params.append("isActive", filters.isActive);

  const res = await authenticatedFetch(
    `${base}/company-bank-accounts?${params.toString()}`,
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

  return res.json();
}

/**
 * Obtener una cuenta bancaria por ID
 */
export async function getBankAccountById(
  id: string
): Promise<CompanyBankAccount> {
  const token = getStoredToken();
  const base = await resolveApiBase();

  const res = await authenticatedFetch(`${base}/company-bank-accounts/${id}`, {
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

/**
 * Crear una nueva cuenta bancaria
 */
export async function createBankAccount(
  input: CreateBankAccountInput
): Promise<CompanyBankAccount> {
  const token = getStoredToken();
  const base = await resolveApiBase();

  const res = await authenticatedFetch(`${base}/company-bank-accounts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Error ${res.status}`);
  }

  return res.json();
}

/**
 * Actualizar una cuenta bancaria
 */
export async function updateBankAccount(
  id: string,
  input: UpdateBankAccountInput
): Promise<CompanyBankAccount> {
  const token = getStoredToken();
  const base = await resolveApiBase();

  const res = await authenticatedFetch(`${base}/company-bank-accounts/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Error ${res.status}`);
  }

  return res.json();
}

/**
 * Eliminar una cuenta bancaria
 */
export async function deleteBankAccount(id: string): Promise<void> {
  const token = getStoredToken();
  const base = await resolveApiBase();

  const res = await authenticatedFetch(`${base}/company-bank-accounts/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Error ${res.status}`);
  }
}

/**
 * Activar/Desactivar una cuenta bancaria
 */
export async function toggleBankAccountActive(
  id: string
): Promise<CompanyBankAccount> {
  const token = getStoredToken();
  const base = await resolveApiBase();

  const res = await authenticatedFetch(`${base}/company-bank-accounts/${id}/toggle-active`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Error ${res.status}`);
  }

  return res.json();
}
