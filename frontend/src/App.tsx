import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import StaffDashboard from "./pages/StaffDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import AccountantDashboard from "./pages/AccountantDashboard";
import AdminUsers from "./pages/AdminUsers";
import RequestDetail from "./pages/RequestDetail";
import Records from "./pages/Records";
import { ReactNode } from "react";
import type { Role } from "./context/AuthContext";

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "MANAGER") return <Navigate to="/manager" replace />;
  if (user.role === "ACCOUNTANT") return <Navigate to="/accountant" replace />;
  if (user.role === "ADMIN") return <Navigate to="/admin" replace />;
  return <Navigate to="/staff" replace />;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <>
      {!loading && user && <Navbar />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<HomeRedirect />} />
        <Route
          path="/staff"
          element={
            <RequireRole roles={["STAFF", "MANAGER", "ACCOUNTANT", "ADMIN"]}>
              <StaffDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/manager"
          element={
            <RequireRole roles={["MANAGER", "ADMIN"]}>
              <ManagerDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/accountant"
          element={
            <RequireRole roles={["ACCOUNTANT", "ADMIN"]}>
              <AccountantDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireRole roles={["ADMIN"]}>
              <AdminUsers />
            </RequireRole>
          }
        />
        <Route
          path="/requests/:id"
          element={
            <RequireRole roles={["STAFF", "MANAGER", "ACCOUNTANT", "ADMIN"]}>
              <RequestDetail />
            </RequireRole>
          }
        />
        <Route
          path="/records"
          element={
            <RequireRole roles={["STAFF", "MANAGER", "ACCOUNTANT", "ADMIN"]}>
              <Records />
            </RequireRole>
          }
        />
      </Routes>
    </>
  );
}
