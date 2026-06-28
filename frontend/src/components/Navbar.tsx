import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  if (!user) return null;

  return (
    <nav className="navbar">
      <div>
        {user.role === "STAFF" && <Link to="/staff">My Requests</Link>}
        {(user.role === "MANAGER" || user.role === "ADMIN") && <Link to="/manager">Approvals</Link>}
        {(user.role === "ACCOUNTANT" || user.role === "ADMIN") && <Link to="/accountant">Processing</Link>}
        {user.role === "ADMIN" && <Link to="/admin">Admin</Link>}
        <Link to="/records">Records</Link>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span>
          {user.name} ({user.role})
        </span>
        <button onClick={handleLogout}>Log out</button>
      </div>
    </nav>
  );
}
