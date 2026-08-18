import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getSession } from "./lib/api";
import Audit from "./pages/Audit";
import GatewayCalls from "./pages/GatewayCalls";
import Login from "./pages/Login";
import Outbox from "./pages/Outbox";
import Payments from "./pages/Payments";
import Stores from "./pages/Stores";
import Webhooks from "./pages/Webhooks";

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getSession()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function protect(el: React.ReactNode) {
  return <RequireAuth>{el}</RequireAuth>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={protect(<Stores />)} />
        <Route path="/payments" element={protect(<Payments />)} />
        <Route path="/gateway-calls" element={protect(<GatewayCalls />)} />
        <Route path="/webhooks" element={protect(<Webhooks />)} />
        <Route path="/outbox" element={protect(<Outbox />)} />
        <Route path="/audit" element={protect(<Audit />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
