import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { FundRequest } from "../types";

export default function AccountantDashboard() {
  const [requests, setRequests] = useState<FundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const data = await api.get<FundRequest[]>("/fund-requests/pending-processing");
    setRequests(data);
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
      ) : requests.length === 0 ? (
        <p>No requests awaiting processing.</p>
      ) : (
        requests.map((r: any) => (
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
    </div>
  );
}
