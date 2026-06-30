import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError, fetchAuthorizedBlob } from "../api/client";
import { FundRequestDetail } from "../types";
import { StatusBadge } from "../components/StatusBadge";

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const [request, setRequest] = useState<FundRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .get<FundRequestDetail>(`/fund-requests/${id}`)
      .then(setRequest)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function openDocument() {
    if (!request) return;
    setDocError(null);
    try {
      const { blob } = await fetchAuthorizedBlob(`/fund-requests/${request.id}/document`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setDocError(err instanceof ApiError ? err.message : "Failed to open document");
    }
  }

  if (loading) return <div className="page">Loading...</div>;
  if (error) return <div className="page error">{error}</div>;
  if (!request) return null;

  const hasBankDetails = request.bankName || request.accountNumber || request.accountName;

  return (
    <div className="page">
      <h1>Request Detail</h1>
      <div className="card">
        <p>
          <strong>Requester:</strong> {request.requester?.name} ({request.requester?.email})
        </p>
        <p>
          <strong>Amount:</strong> {request.currency} {request.amount}
        </p>
        <p>
          <strong>Purpose:</strong> {request.purpose}
        </p>
        {request.description && (
          <p>
            <strong>Description:</strong> {request.description}
          </p>
        )}
        <p>
          <strong>Status:</strong> <StatusBadge status={request.status} />
        </p>
      </div>

      {hasBankDetails && (
        <div className="card">
          <p className="section-title" style={{ marginBottom: 8 }}>
            Bank Details
          </p>
          {request.bankName && (
            <p>
              <strong>Bank Name:</strong> {request.bankName}
            </p>
          )}
          {request.accountNumber && (
            <p>
              <strong>Account Number:</strong> {request.accountNumber}
            </p>
          )}
          {request.accountName && (
            <p>
              <strong>Account Name:</strong> {request.accountName}
            </p>
          )}
        </div>
      )}

      {request.documentName && (
        <div className="card">
          <p className="section-title" style={{ marginBottom: 8 }}>
            Supporting Document
          </p>
          <button type="button" className="primary" onClick={openDocument}>
            View {request.documentName}
          </button>
          {docError && <div className="error">{docError}</div>}
        </div>
      )}

      <h3>History</h3>
      <ul>
        {request.approvalEvents.map((ev) => (
          <li key={ev.id} className="card">
            <strong>{ev.action}</strong> by {ev.actor.name} ({ev.actor.role}) on{" "}
            {new Date(ev.createdAt).toLocaleString()}
            {ev.comment && <div>Comment: {ev.comment}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
