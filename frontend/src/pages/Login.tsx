import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";

const ORG_NAME = "Ekiema Group";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <img src="/logo.png" alt={ORG_NAME} className="auth-logo-img" />
        <h1>Welcome to {ORG_NAME}</h1>
        <p className="auth-sub">Sign in to access your ERP dashboard</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <div className="field-row">
              <label>Password</label>
              <a href="#" onClick={(e) => e.preventDefault()}>
                Forgot password?
              </a>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="checkbox-row">
            <input type="checkbox" id="remember" />
            <label htmlFor="remember">Remember me</label>
          </div>

          {error && <div className="error">{error}</div>}

          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: 14 }}>
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>

        <div className="auth-footer">
          {ORG_NAME} © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
