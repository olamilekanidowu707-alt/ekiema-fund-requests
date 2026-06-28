import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Role } from "../context/AuthContext";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  managerId: string | null;
}

const ROLES: Role[] = ["STAFF", "MANAGER", "ACCOUNTANT", "ADMIN"];

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const data = await api.get<AdminUser[]>("/users");
    setUsers(data);
    setNameDrafts(Object.fromEntries(data.map((u) => [u.id, u.name])));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateRole(id: string, role: Role) {
    setSavingId(id);
    try {
      await api.patch(`/users/${id}`, { role });
      await load();
    } finally {
      setSavingId(null);
    }
  }

  async function updateManager(id: string, managerId: string) {
    setSavingId(id);
    try {
      await api.patch(`/users/${id}`, { managerId: managerId || null });
      await load();
    } finally {
      setSavingId(null);
    }
  }

  async function updateName(id: string, name: string) {
    const original = users.find((u) => u.id === id)?.name;
    if (!name.trim() || name === original) return;
    setSavingId(id);
    try {
      await api.patch(`/users/${id}`, { name: name.trim() });
      await load();
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <div className="page">Loading...</div>;

  return (
    <div className="page">
      <h1>Manage Users</h1>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Manager</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <input
                  value={nameDrafts[u.id] ?? u.name}
                  disabled={savingId === u.id}
                  onChange={(e) => setNameDrafts({ ...nameDrafts, [u.id]: e.target.value })}
                  onBlur={(e) => updateName(u.id, e.target.value)}
                  style={{ width: 140 }}
                />
              </td>
              <td>{u.email}</td>
              <td>
                <select
                  value={u.role}
                  disabled={savingId === u.id}
                  onChange={(e) => updateRole(u.id, e.target.value as Role)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  value={u.managerId ?? ""}
                  disabled={savingId === u.id}
                  onChange={(e) => updateManager(u.id, e.target.value)}
                >
                  <option value="">(none)</option>
                  {users
                    .filter((m) => m.id !== u.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
