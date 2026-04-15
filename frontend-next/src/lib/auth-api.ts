import { AUTH_SESSION_KEY, AUTH_TOKEN_KEY, resolveApiBase } from "@/lib/runtime-config";

export type LoginResponse = {
  access_token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role?: string;
  };
};

export type AuthSession = {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role?: string;
  };
  loginAt: string;
};

export type AdminUserListItem = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  activeAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const parseErrorMessage = (payload: unknown, fallback: string): string => {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const message = (payload as { message?: unknown }).message;
  if (Array.isArray(message)) {
    return message.join(", ");
  }
  if (typeof message === "string" && message.trim()) {
    return message;
  }

  return fallback;
};

export const loginWithEmailPassword = async (
  email: string,
  password: string,
): Promise<LoginResponse> => {
  const apiBase = resolveApiBase();
  if (!apiBase) {
    throw new Error("No hay API configurada.");
  }

  const response = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: String(email || "").trim(),
      password: String(password || ""),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseErrorMessage(payload, "No se pudo iniciar sesion."));
  }

  const token = String(
    (
      payload as {
        access_token?: string;
        accessToken?: string;
      }
    ).access_token ||
      (
        payload as {
          access_token?: string;
          accessToken?: string;
        }
      ).accessToken ||
      "",
  ).trim();
  const user = (payload as { user?: LoginResponse["user"] }).user;

  if (!token || !user?.id) {
    throw new Error("Respuesta de login invalida.");
  }

  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  const session: AuthSession = {
    token,
    user,
    loginAt: new Date().toISOString(),
  };
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  return {
    access_token: token,
    user,
  };
};

export const getStoredToken = (): string => {
  if (typeof window === "undefined") {
    return "";
  }
  return String(window.localStorage.getItem(AUTH_TOKEN_KEY) || "").trim();
};

export const clearStoredToken = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_SESSION_KEY);
};

export const getStoredSession = (): AuthSession | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = String(window.localStorage.getItem(AUTH_SESSION_KEY) || "").trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    const token = String(parsed?.token || "").trim();
    const loginAt = String(parsed?.loginAt || "").trim();
    const user = parsed?.user;
    if (!token || !loginAt || !user?.id || !user?.email || !user?.fullName) {
      return null;
    }

    return {
      token,
      loginAt,
      user: {
        id: String(user.id),
        email: String(user.email),
        fullName: String(user.fullName),
        role: user.role ? String(user.role) : undefined,
      },
    };
  } catch {
    return null;
  }
};

const authHeaders = (): HeadersInit => {
  const token = getStoredToken();
  if (!token) {
    throw new Error("Tu sesion no esta activa. Inicia sesion nuevamente.");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

export const adminListUsers = async (): Promise<AdminUserListItem[]> => {
  const apiBase = resolveApiBase();
  if (!apiBase) {
    throw new Error("No hay API configurada.");
  }

  const response = await fetch(`${apiBase}/auth/users`, {
    method: "GET",
    headers: authHeaders(),
  });

  const payload = await response.json().catch(() => ([]));
  if (!response.ok) {
    throw new Error(parseErrorMessage(payload, "No se pudo cargar usuarios."));
  }

  return Array.isArray(payload) ? (payload as AdminUserListItem[]) : [];
};

export const adminCreateUser = async (input: {
  email: string;
  fullName: string;
  password: string;
  role: "AGENT" | "ADMIN";
}): Promise<AdminUserListItem> => {
  const apiBase = resolveApiBase();
  if (!apiBase) {
    throw new Error("No hay API configurada.");
  }

  const response = await fetch(`${apiBase}/auth/users`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseErrorMessage(payload, "No se pudo crear el usuario."));
  }

  return payload as AdminUserListItem;
};

export const adminUpdateUser = async (
  userId: string,
  input: Partial<{ fullName: string; role: "AGENT" | "ADMIN"; isActive: boolean }>,
): Promise<AdminUserListItem> => {
  const apiBase = resolveApiBase();
  if (!apiBase) {
    throw new Error("No hay API configurada.");
  }

  const response = await fetch(`${apiBase}/auth/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseErrorMessage(payload, "No se pudo actualizar el usuario."));
  }

  return payload as AdminUserListItem;
};
