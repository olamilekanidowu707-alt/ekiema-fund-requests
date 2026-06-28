import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { FundRequestDetail } from "../types";
import { StatusBadge } from "../components/StatusBadge";

function approverName(request: FundRequestDetail, actions: string[]) {
  const event = request.approvalEvents?.find((ev) => actions.includes(ev.action));
  return event ? event.actor.name : "—";
}

export default function AccountantDashboard() {
  const [pending, setPending] = useState<FundRequestDetail[]>([]);
  const [all, setAll] = useState<FundRequestDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [pendingData, allData] = await Promise.all([
      api.get<FundRequestDetail[]>("/fund-requests/pending-processing"),
      api.get<FundRequestDetail[]>("/fund-requests/all"),
    ]);
    setPending(pendingData);
    setAll(allData);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, approve: boolean) {
    setBusyId(id);
    try {
      await api.patch(`/fund-requests/${id}/accountant-decision`, { approve, comment: comments[id] });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <h1>Pending Processing</h1>
      {loading ? (
        <p>Loading...</p>
      ) : pending.length === 0 ? (
        <p>No requests awaiting processing.</p>
      ) : (
        pending.map((r) => (
          <div className="card" key={r.id}>
            <p>
              <strong>{r.requester?.name}</strong> ({r.requester?.email}) approved by manager for{" "}
              <strong>
                {r.currency} {r.amount}
              </strong>
            </p>
            <p>{r.purpose}</p>
            <p>
              <Link to={`/requests/${r.id}`}>View details</Link>
            </p>
            <textarea
              placeholder="Optional comment"
              value={comments[r.id] ?? ""}
              onChange={(e) => setComments({ ...comments, [r.id]: e.target.value })}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="primary" disabled={busyId === r.id} onClick={() => decide(r.id, true)}>
                Mark Paid
              </button>
              <button className="danger" disabled={busyId === r.id} onClick={() => decide(r.id, false)}>
                Reject
              </button>
            </div>
          </div>
        ))
      )}

      <h2 style={{ marginTop: 40 }}>All Payment Records</h2>
      {loading ? (
        <p>Loading...</p>
      ) : all.length === 0 ? (
        <p>No records yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Requester</th>
              <th>Amount</th>
              <th>Purpose</th>
              <th>Status</th>
              <th>Approved By</th>
              <th>Paid / Rejected By</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {all.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                <td>{r.requester?.name}</td>
                <td>
                  {r.currency} {r.amount}
                </td>
                <td>{r.purpose}</td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td>{approverName(r, ["MANAGER_APPROVED", "MANAGER_REJECTED"])}</td>
                <td>{approverName(r, ["ACCOUNTANT_PAID", "ACCOUNTANT_REJECTED"])}</td>
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
