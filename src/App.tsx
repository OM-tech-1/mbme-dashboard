import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getSession } from "./lib/api";
import Login from "./pages/Login";
import Stores from "./pages/Stores";

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getSession()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Stores />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
