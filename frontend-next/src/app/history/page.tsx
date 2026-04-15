"use client";

import { getStoredToken } from "@/lib/auth-api";
import {
  type ContractFileDocument,
  type HistoryContractItem,
  deleteContractDraft,
  getContractFiles,
  resendSignedEmail,
  searchContracts,
} from "@/lib/contracts-api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const STATUS_SIGNED = "SIGNED";

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-CR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function HistoryPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<HistoryContractItem[]>([]);
  const [busyAction, setBusyAction] = useState<string>("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerTitle, setViewerTitle] = useState("Visor");
  const [viewerMode, setViewerMode] = useState<"html" | "documents">("html");
  const [viewerHtml, setViewerHtml] = useState("");
  const [viewerDocs, setViewerDocs] = useState<ContractFileDocument[]>([]);
  const [draftToDelete, setDraftToDelete] = useState<{ id: string; contractNumber: string; clientFullName: string } | null>(null);

  const closeViewer = () => {
    setViewerOpen(false);
    setViewerTitle("Visor");
    setViewerMode("html");
    setViewerHtml("");
    setViewerDocs([]);
  };

  useEffect(() => {
    if (!viewerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeViewer();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewerOpen]);

  const load = async (q = "") => {
    setLoading(true);
    setError("");
    try {
      const result = await searchContracts({ q, limit: 50 });
      setItems(result);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "No se pudo cargar historial.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load(query);
    }, 260);

    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/");
      return;
    }

    void load();
  }, [router]);

  const statusInfo = (status: string) => {
    const normalized = String(status || "").trim().toUpperCase();
    if (normalized === "DRAFT") {
      return { label: "Borrador", className: "status-draft" };
    }
    if (normalized === STATUS_SIGNED) {
      return { label: "Firmado", className: "status-signed" };
    }
    return { label: "Pendiente", className: "status-pending" };
  };

  const getDocKind = (name: string) => {
    const normalized = String(name || "").toLowerCase();

    if (normalized.includes("titular-")) {
      if (normalized.includes("cedula-frente") || normalized.includes("cedula_front")) return "titular-cedula-front";
      if (normalized.includes("cedula-reverso") || normalized.includes("cedula_back")) return "titular-cedula-back";
      if (normalized.includes("pasaporte") || normalized.includes("passport")) return "titular-passport";
    }

    const companionMatch = normalized.match(/acompanante(\d+)/);
    if (companionMatch) {
      const n = companionMatch[1];
      if (normalized.includes("cedula-frente") || normalized.includes("cedula_front")) return `companion${n}-cedula-front`;
      if (normalized.includes("cedula-reverso") || normalized.includes("cedula_back")) return `companion${n}-cedula-back`;
      if (normalized.includes("pasaporte") || normalized.includes("passport")) return `companion${n}-passport`;
    }

    const minorMatch = normalized.match(/menor(\d+)/);
    if (minorMatch) {
      const n = minorMatch[1];
      if (normalized.includes("tutor-")) {
        if (normalized.includes("cedula-frente") || normalized.includes("cedula_front")) return `minor${n}-tutor-cedula-front`;
        if (normalized.includes("cedula-reverso") || normalized.includes("cedula_back")) return `minor${n}-tutor-cedula-back`;
        if (normalized.includes("pasaporte") || normalized.includes("passport")) return `minor${n}-tutor-passport`;
      } else {
        if (normalized.includes("cedula-frente") || normalized.includes("cedula_front")) return `minor${n}-cedula-front`;
        if (normalized.includes("cedula-reverso") || normalized.includes("cedula_back")) return `minor${n}-cedula-back`;
        if (normalized.includes("pasaporte") || normalized.includes("passport")) return `minor${n}-passport`;
      }
    }

    return "other";
  };

  const openContractPdf = async (contractId: string) => {
    setBusyAction(`contract:${contractId}`);
    try {
      const files = await getContractFiles(contractId);
      const url = files.signedPdf?.url || files.pdf?.url || "";
      if (!url) {
        setViewerTitle("Contrato");
        setViewerMode("html");
        setViewerHtml('<p class="history-empty">No hay contrato disponible.</p>');
      } else {
        setViewerTitle("Contrato");
        setViewerMode("html");
        setViewerHtml(`<iframe src="${url}" title="Contrato" class="viewer-iframe"></iframe>`);
      }
      setViewerOpen(true);
    } catch (actionError) {
      setViewerTitle("Error");
      setViewerMode("html");
      setViewerHtml(`<p class="history-empty">${actionError instanceof Error ? actionError.message : "No se pudo abrir el contrato."}</p>`);
      setViewerOpen(true);
    } finally {
      setBusyAction("");
    }
  };

  const openDocuments = async (contractId: string) => {
    setBusyAction(`documents:${contractId}`);
    try {
      const files = await getContractFiles(contractId);
      setViewerTitle("Documentos del contrato");
      setViewerMode("documents");
      setViewerDocs(files.documents || []);
      setViewerOpen(true);
    } catch (actionError) {
      setViewerTitle("Error");
      setViewerMode("html");
      setViewerHtml(`<p class="history-empty">${actionError instanceof Error ? actionError.message : "No se pudieron abrir los documentos."}</p>`);
      setViewerOpen(true);
    } finally {
      setBusyAction("");
    }
  };

  const onResendSigned = async (contractId: string) => {
    setBusyAction(`resend:${contractId}`);
    try {
      const result = await resendSignedEmail(contractId);
      if (result.sentCount > 0) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === contractId
              ? {
                  ...item,
                  signedContractResent: true,
                  signedContractResentAt: new Date().toISOString(),
                }
              : item,
          ),
        );
      }
      setViewerTitle("Reenvio de contrato firmado");
      setViewerMode("html");
      setViewerHtml(
        `<article class="viewer-doc"><p>${result.sentCount > 0 ? "Contrato reenviado exitosamente." : "No se enviaron correos."}</p></article>`,
      );
      setViewerOpen(true);
    } catch (actionError) {
      setViewerTitle("Error");
      setViewerMode("html");
      setViewerHtml(`<p class="history-empty">${actionError instanceof Error ? actionError.message : "No se pudo reenviar."}</p>`);
      setViewerOpen(true);
    } finally {
      setBusyAction("");
    }
  };

  const openDeleteDraftModal = (item: HistoryContractItem) => {
    setDraftToDelete({
      id: item.id,
      contractNumber: item.contractNumber,
      clientFullName: item.clientFullName,
    });
  };

  const closeDeleteDraftModal = () => {
    if (busyAction === "delete-draft:confirm") return;
    setDraftToDelete(null);
  };

  const confirmDeleteDraft = async () => {
    if (!draftToDelete) return;

    const draftId = draftToDelete.id;
    setBusyAction("delete-draft:confirm");
    try {
      await deleteContractDraft(draftId);
      setItems((prev) => prev.filter((item) => item.id !== draftId));
      setStatusMessage("Borrador eliminado correctamente.");
      setDraftToDelete(null);
    } catch (actionError) {
      setStatusMessage(actionError instanceof Error ? actionError.message : "No se pudo eliminar el borrador.");
    } finally {
      setBusyAction("");
    }
  };

  const [statusMessage, setStatusMessage] = useState("");

  const groupedDocuments = useMemo(() => {
    const byGroup: Record<string, ContractFileDocument[]> = {};
    for (const doc of viewerDocs) {
      const kind = getDocKind(doc.originalFileName);
      let key = "Otros documentos";
      if (kind.startsWith("titular-")) key = "Titular";
      else if (kind.startsWith("companion")) key = `Acompanante ${kind.replace("companion", "").split("-")[0]}`;
      else if (kind.startsWith("minor")) key = `Menor ${kind.replace("minor", "").split("-")[0]}`;

      if (!byGroup[key]) byGroup[key] = [];
      byGroup[key].push(doc);
    }
    return byGroup;
  }, [viewerDocs]);

  return (
    <main className="app-shell">
      <section className="card contracts-card">
        <h1>Historial de contratos</h1>

        <div className="inline-row history-search-row">
          <input
            value={query}
            placeholder="Buscar por numero, cliente, cedula o correo"
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              void load(query);
            }}
            disabled={loading}
          >
            Buscar
          </button>
        </div>

        {loading ? <p className="muted">Cargando historial...</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        {!error && statusMessage ? <p className="muted">{statusMessage}</p> : null}

        {!loading && !error && items.length === 0 ? <p className="muted">No se encontraron contratos.</p> : null}

        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Cedula</th>
                <th>Correo</th>
                <th>Telefono</th>
                <th>Numero contrato</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const status = statusInfo(item.status);
                const isSigned = String(item.status || "").toUpperCase() === STATUS_SIGNED;
                const isDraft = String(item.status || "").toUpperCase() === "DRAFT";
                const isResendDone = Boolean(item.signedContractResent);
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="history-col-name">{item.clientFullName}</div>
                      <div className="history-col-muted">{formatDateTime(item.createdAt)}</div>
                    </td>
                    <td>{item.clientIdNumber || "-"}</td>
                    <td>{item.clientEmail || "-"}</td>
                    <td>{item.clientPhone || "-"}</td>
                    <td>{item.contractNumber}</td>
                    <td>
                      <span className={`contract-status ${status.className}`}>{status.label}</span>
                    </td>
                    <td>
                      <div className="history-actions">
                        {isDraft ? (
                          <>
                            <Link href={`/contracts?draftId=${encodeURIComponent(item.id)}`} className="btn btn-secondary">
                              Continuar borrador
                            </Link>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => openDeleteDraftModal(item)}
                              disabled={busyAction === "delete-draft:confirm"}
                            >
                              Eliminar borrador
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => void openContractPdf(item.id)}
                              disabled={busyAction === `contract:${item.id}`}
                            >
                              {busyAction === `contract:${item.id}` ? "Abriendo..." : "Contrato"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => void openDocuments(item.id)}
                              disabled={busyAction === `documents:${item.id}`}
                            >
                              {busyAction === `documents:${item.id}` ? "Abriendo..." : "Documentos"}
                            </button>
                          </>
                        )}
                        {isSigned ? (
                          <button
                            type="button"
                            className={`btn ${isResendDone ? "btn-success" : "btn-secondary"}`}
                            onClick={() => void onResendSigned(item.id)}
                            disabled={busyAction === `resend:${item.id}` || isResendDone}
                          >
                            {busyAction === `resend:${item.id}`
                              ? "Enviando..."
                              : isResendDone
                                ? "Contrato firmado enviado"
                                : "Reenviar firmado"}
                          </button>
                        ) : null}
                        {isSigned ? (
                          <Link href={`/billing/${encodeURIComponent(item.id)}`} className="btn btn-secondary">
                            Estado de cuenta
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {viewerOpen ? (
        <section className="viewer-modal" onClick={closeViewer}>
          <div className="viewer-panel" onClick={(event) => event.stopPropagation()}>
            <div className="viewer-head">
              <h2>{viewerTitle}</h2>
              <button type="button" className="btn btn-secondary" onClick={closeViewer}>
                Cerrar
              </button>
            </div>

            <div className="viewer-body">
              {viewerMode === "html" ? (
                <div dangerouslySetInnerHTML={{ __html: viewerHtml }} />
              ) : (
                Object.entries(groupedDocuments).map(([group, docs]) => (
                  <section key={group} className="doc-person-group">
                    <h4>{group}</h4>
                    <div className="doc-grid">
                      {docs.map((doc) => (
                        <article key={doc.id} className="viewer-doc-card">
                          <p className="viewer-doc-card-title">{doc.originalFileName}</p>
                          {String(doc.mimeType || "").startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={doc.url} alt={doc.originalFileName} loading="lazy" />
                          ) : String(doc.mimeType || "").toLowerCase() === "application/pdf" ? (
                            <embed src={doc.url} type="application/pdf" />
                          ) : (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer">
                              Ver documento
                            </a>
                          )}
                        </article>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          </div>
        </section>
      ) : null}

      {draftToDelete ? (
        <section className="viewer-modal" onClick={closeDeleteDraftModal}>
          <div className="viewer-panel draft-delete-modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="viewer-head">
              <h2>Confirmar eliminacion de borrador</h2>
              <button type="button" className="btn btn-secondary" onClick={closeDeleteDraftModal} disabled={busyAction === "delete-draft:confirm"}>
                Cerrar
              </button>
            </div>

            <div className="viewer-body draft-delete-modal-body">
              <p>
                Vas a eliminar el borrador <strong>{draftToDelete.contractNumber}</strong>
                {draftToDelete.clientFullName && draftToDelete.clientFullName !== "-" ? ` de ${draftToDelete.clientFullName}` : ""}.
              </p>
              <p className="form-error">Esta accion no se puede deshacer.</p>

              <div className="history-actions">
                <button type="button" className="btn btn-secondary" onClick={closeDeleteDraftModal} disabled={busyAction === "delete-draft:confirm"}>
                  Cancelar
                </button>
                <button type="button" className="btn" onClick={() => void confirmDeleteDraft()} disabled={busyAction === "delete-draft:confirm"}>
                  {busyAction === "delete-draft:confirm" ? "Eliminando..." : "Eliminar borrador"}
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
