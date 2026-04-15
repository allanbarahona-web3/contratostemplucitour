"use client";

import {
  adminCreateUser,
  adminListUsers,
  adminUpdateUser,
  getStoredSession,
  getStoredToken,
  type AdminUserListItem,
} from "@/lib/auth-api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const roleLabel = (role: string) => (String(role || "").toUpperCase() === "ADMIN" ? "ADMIN" : "AGENT");

export default function AdminUsersPage() {
  const router = useRouter();
  const session = getStoredSession();
  const role = String(session?.user?.role || "").toUpperCase();
  const isAdmin = role === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<AdminUserListItem[]>([]);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState<"AGENT" | "ADMIN">("AGENT");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const users = await adminListUsers();
      setItems(users);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "No se pudo cargar usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/");
      return;
    }

    if (!isAdmin) {
      router.replace("/contracts");
      return;
    }

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const onCreate = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await adminCreateUser({
        email: String(email || "").trim(),
        fullName: String(fullName || "").trim(),
        password: String(password || ""),
        role: newRole,
      });
      setStatus("Usuario creado correctamente.");
      setEmail("");
      setFullName("");
      setPassword("");
      setNewRole("AGENT");
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No se pudo crear el usuario.");
    } finally {
      setSaving(false);
    }
  };

  const onToggleActive = async (item: AdminUserListItem) => {
    try {
      await adminUpdateUser(item.id, { isActive: !item.isActive });
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "No se pudo actualizar estado.");
    }
  };

  const onToggleRole = async (item: AdminUserListItem) => {
    const nextRole: "AGENT" | "ADMIN" = roleLabel(item.role) === "ADMIN" ? "AGENT" : "ADMIN";
    try {
      await adminUpdateUser(item.id, { role: nextRole });
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "No se pudo actualizar rol.");
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <main className="app-shell">
      <section className="card contracts-card">
        <h1>Admin - Usuarios</h1>
        <p className="muted">Solo ADMIN puede crear usuarios y otorgar permisos de vistas administrativas.</p>

        <div className="contracts-grid" style={{ marginTop: 12 }}>
          <label>
            Correo
            <input value={email} type="email" onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Nombre completo
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </label>
          <label>
            Password temporal
            <input value={password} type="password" onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label>
            Rol
            <select value={newRole} onChange={(event) => setNewRole((event.target.value as "AGENT" | "ADMIN") || "AGENT")}>
              <option value="AGENT">AGENT</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>
          <div className="actions" style={{ alignItems: "flex-end", marginTop: 22 }}>
            <button type="button" className="btn" disabled={saving} onClick={() => void onCreate()}>
              {saving ? "Guardando..." : "Crear usuario"}
            </button>
          </div>
        </div>

        {error ? <p className="form-error" style={{ marginTop: 10 }}>{error}</p> : null}
        {status ? <p className="status-line">{status}</p> : null}

        <div className="history-table-wrap" style={{ marginTop: 14 }}>
          <table className="history-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Activo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 ? (
                <tr><td colSpan={5}><p className="history-empty">No hay usuarios.</p></td></tr>
              ) : null}
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.fullName}</td>
                  <td>{item.email}</td>
                  <td>{roleLabel(item.role)}</td>
                  <td>{item.isActive ? "SI" : "NO"}</td>
                  <td>
                    <div className="actions" style={{ marginTop: 0 }}>
                      <button type="button" className="btn btn-secondary" onClick={() => void onToggleRole(item)}>
                        Cambiar a {roleLabel(item.role) === "ADMIN" ? "AGENT" : "ADMIN"}
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => void onToggleActive(item)}>
                        {item.isActive ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
