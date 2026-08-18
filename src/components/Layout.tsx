import { NavLink, useNavigate } from "react-router-dom";
import { clearSession } from "../lib/api";

const TABS = [
  { to: "/", label: "Stores", end: true },
  { to: "/payments", label: "Payments" },
  { to: "/gateway-calls", label: "Gateway calls" },
  { to: "/webhooks", label: "Webhooks" },
  { to: "/outbox", label: "Outbox" },
  { to: "/audit", label: "Audit" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  function logout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500 text-sm font-bold text-white">
              M
            </div>
            <span className="text-sm font-semibold text-ink-100">MBME Payments · Admin</span>
          </div>
          <button
            onClick={logout}
            className="rounded-lg px-3 py-1.5 text-sm text-ink-300 transition hover:bg-ink-800 hover:text-ink-100"
          >
            Sign out
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-6">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                "border-b-2 px-3 py-2.5 text-sm font-medium transition " +
                (isActive
                  ? "border-accent-500 text-ink-100"
                  : "border-transparent text-ink-400 hover:text-ink-200")
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
