import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../api/client";

interface ManagerOption {
  id: string;
  name: string;
}

type SignupRole = "STAFF" | "MANAGER" | "ACCOUNTANT";

const ROLE_OPTIONS: { value: SignupRole; label: string; description: string }[] = [
  { value: "STAFF", label: "Staff", description: "Submit fund requests for approval" },
  { value: "MANAGER", label: "Manager", description: "Approve fund requests from your reports" },
  { value: "ACCOUNTANT", label: "Accountant", description: "Process and pay approved requests" },
];

export default function Signup() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SignupRole>("STAFF");
  const [managerId, setManagerId] = useState("");
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<ManagerOption[]>("/auth/managers").then(setManagers);
  }, []);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup(name, email, password, role, managerId || undefined);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Signup failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <h1>Sign up</h1>
      <form className="stacked" onSubmit={handleSubmit}>
        <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          type="password"
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />

        <div className="field">
          <label>I am a...</label>
          {ROLE_OPTIONS.map((opt) => (
            <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <input
                type="radio"
                name="role"
                value={opt.value}
                checked={role === opt.value}
                onChange={() => setRole(opt.value)}
              />
              <span>
                <strong>{opt.label}</strong> — {opt.description}
              </span>
            </label>
          ))}
        </div>

        <div className="field">
          <label>Line Manager</label>
          <select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">Select your manager</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {error && <div className="error">{error}</div>}
        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? "Creating account..." : "Sign up"}
        </button>
      </form>
      <p>
        Your selected manager will be able to approve fund requests you submit. Need a different
        role, like Admin? Ask an existing admin to set it from the Manage Users page.
      </p>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
