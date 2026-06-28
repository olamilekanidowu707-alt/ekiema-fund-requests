import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { api } from "../api/client";
import { FundRequest, FundRequestStatus } from "../types";
import { StatusBadge } from "../components/StatusBadge";

const STATUSES: FundRequestStatus[] = [
  "PENDING_MANAGER",
  "PENDING_ACCOUNTANT",
  "PAID",
  "REJECTED_BY_MANAGER",
  "REJECTED_BY_ACCOUNTANT",
];

interface RecordRow extends FundRequest {
  requester?: { id: string; name: string; email: string };
}

export default function Records() {
  const [results, setResults] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  async function search(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    const params = new URLSearchParams();
    if (name) params.set("q", name);
    if (status) params.set("status", status);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (minAmount) params.set("minAmount", minAmount);
    if (maxAmount) params.set("maxAmount", maxAmount);

    const data = await api.get<RecordRow[]>(`/fund-requests/records?${params.toString()}`);
    setResults(data);
    setLoading(false);
    setSearched(true);
  }

  function toRows() {
    return results.map((r) => ({
      Date: new Date(r.createdAt).toLocaleDateString(),
      Requester: r.requester?.name ?? "",
      Email: r.requester?.email ?? "",
      Amount: r.amount,
      Currency: r.currency,
      Purpose: r.purpose,
      Description: r.description ?? "",
      Status: r.status,
    }));
  }

  function exportExcel() {
    const rows = toRows();
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Fund Requests");
    XLSX.writeFile(workbook, "fund-requests.xlsx");
  }

  function exportPdf() {
    const rows = toRows();
    const doc = new jsPDF();
    doc.text("Fund Request Records", 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [["Date", "Requester", "Amount", "Purpose", "Status"]],
      body: rows.map((r) => [r.Date, r.Requester, `${r.Currency} ${r.Amount}`, r.Purpose, r.Status]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [107, 33, 168] },
    });
    doc.save("fund-requests.pdf");
  }

  return (
    <div className="page">
      <h1>Records</h1>

      <form className="section" onSubmit={search}>
        <p className="section-title">Search & Filter</p>
        <p className="section-sub">Find fund requests by requester, status, date range, or amount</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <div className="field">
            <label>Requester name</label>
            <input placeholder="e.g. Alice" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Any</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div></div>
          <div className="field">
            <label>Date from</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>Date to</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div></div>
          <div className="field">
            <label>Min amount</label>
            <input type="number" step="0.01" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
          </div>
          <div className="field">
            <label>Max amount</label>
            <input type="number" step="0.01" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
          {results.length > 0 && (
            <>
              <button type="button" onClick={exportExcel}>
                Export Excel
              </button>
              <button type="button" onClick={exportPdf}>
                Export PDF
              </button>
            </>
          )}
        </div>
      </form>

      {searched && (
        <>
          {results.length === 0 ? (
            <p>No matching records.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Requester</th>
                  <th>Amount</th>
                  <th>Purpose</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
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
                    <td>
                      <Link to={`/requests/${r.id}`}>View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
