import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { FundRequest } from "../types";
import { StatusBadge } from "../components/StatusBadge";

export default function StaffDashboard() {
  const [requests, setRequests] = useState<FundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const data = await api.get<FundRequest[]>("/fund-requests/mine");
    setRequests(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/fund-requests", {
        amount: Number(amount),
        purpose,
        description: description || undefined,
      });
      setAmount("");
      setPurpose("");
      setDescription("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="form-header">
        <span className="back-link">←</span>
        <div>
          <h2>New Fund Request</h2>
          <p>Submit a new fund request for approval</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="section">
          <p className="section-title">Request Details</p>
          <p className="section-sub">Provide details about the fund request</p>

          <div className="field">
            <label>Purpose</label>
            <input
              placeholder="Brief summary of what the funds are for"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label>Description</label>
            <textarea
              placeholder="Add more detail or justification for this request"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="section">
          <p className="section-title">Total Amount</p>
          <p className="section-sub">Enter the amount you are requesting</p>

          <div className="field">
            <label>Amount (NGN)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="total-bar">
            <span>Total</span>
            <span>NGN {amount ? Number(amount).toFixed(2) : "0.00"}</span>
          </div>
        </div>

        {error && <div className="error">{error}</div>}
        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Request"}
        </button>
      </form>

      <h3 style={{ marginTop: 32 }}>History</h3>
      {loading ? (
        <p>Loading...</p>
      ) : requests.length === 0 ? (
        <p>No requests yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Purpose</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                <td>
                  {r.currency} {r.amount}
                </td>
                <td>{r.purpose}</td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td>
                  <Link to={`/requests/${r.id}`}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
