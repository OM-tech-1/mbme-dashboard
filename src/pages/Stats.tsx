import { useEffect, useState, useCallback } from "react";
import Layout from "../components/Layout";
import { ApiError, getStats, listStores, type Stats, type StoreView } from "../lib/api";

const WINDOW_PRESETS = [
  { label: "1h", value: "1h" },
  { label: "6h", value: "6h" },
  { label: "12h", value: "12h" },
  { label: "24h", value: "24h" },
  { label: "3d", value: "72h" },
  { label: "7d", value: "168h" },
  { label: "30d", value: "720h" },
];

const STATE_COLORS: Record<string, string> = {
  APPROVED: "bg-emerald-500",
  FAILED: "bg-red-500",
  LINK_ISSUED: "bg-amber-500",
  PENDING: "bg-amber-400",
  CREATED: "bg-ink-500",
  REDIRECTED: "bg-blue-500",
  EXPIRED: "bg-red-400",
  REFUND_PENDING: "bg-purple-500",
  REFUNDED: "bg-emerald-400",
  PARTIALLY_REFUNDED: "bg-emerald-300",
};

function toCSV(stats: Stats, window: string): string {
  const lines: string[] = [];

  lines.push("MBME Payments Report");
  lines.push(`Window,${window}`);
  lines.push(`Since,${stats.since}`);
  lines.push("");

  lines.push("Payments by State");
  lines.push("State,Count");
  for (const [state, count] of Object.entries(stats.payments_by_state)) {
    lines.push(`${state},${count}`);
  }
  lines.push("");

  lines.push("Approved Amount by Currency");
  lines.push("Currency,Amount (minor)");
  for (const [cur, amt] of Object.entries(stats.approved_amount_minor_by_currency)) {
    lines.push(`${cur},${amt}`);
  }
  lines.push("");

  lines.push("System Health");
  lines.push(`Outbox Pending,${stats.outbox_pending}`);
  lines.push(`Outbox Dead Lettered,${stats.outbox_dead_lettered}`);
  lines.push(`Webhook Signature Failures,${stats.webhook_signature_failures}`);
  lines.push(`Gateway Call Errors,${stats.gateway_call_errors}`);

  return lines.join("\n");
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Stats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [window, setWindow] = useState("24h");
  const [storeId, setStoreId] = useState("");
  const [mode, setMode] = useState("");
  const [stores, setStores] = useState<StoreView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listStores()
      .then((r) => setStores(r.items))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await getStats({
        window: window || undefined,
        store_id: storeId || undefined,
        mode: mode || undefined,
      });
      setStats(s);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load stats.");
    } finally {
      setLoading(false);
    }
  }, [window, storeId, mode]);

  useEffect(() => {
    load();
  }, [load]);

  function handleDownload() {
    if (!stats) return;
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    downloadCSV(toCSV(stats, window), `mbme-stats-${window}-${ts}.csv`);
  }

  const totalPayments = stats
    ? Object.values(stats.payments_by_state).reduce((a, b) => a + b, 0)
    : 0;
  const approvedCount = stats?.payments_by_state["APPROVED"] ?? 0;
  const failedCount = stats?.payments_by_state["FAILED"] ?? 0;
  const successRate = totalPayments > 0 ? ((approvedCount / totalPayments) * 100).toFixed(1) : "0";
  const pendingCount =
    (stats?.payments_by_state["CREATED"] ?? 0) +
    (stats?.payments_by_state["LINK_ISSUED"] ?? 0) +
    (stats?.payments_by_state["PENDING"] ?? 0) +
    (stats?.payments_by_state["REDIRECTED"] ?? 0);

  return (
    <Layout>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-100">Stats</h1>
          <p className="mt-1 text-sm text-ink-300">
            Payment activity overview for the selected time window.
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={!stats}
          className="rounded-lg bg-ink-700 px-4 py-2 text-sm font-medium text-ink-100 transition hover:bg-ink-600 disabled:opacity-50"
        >
          ↓ Download CSV
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          {WINDOW_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setWindow(p.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                window === p.value
                  ? "bg-accent-500/20 text-accent-400"
                  : "bg-ink-800 text-ink-400 hover:text-ink-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-ink-100 outline-none focus:border-accent-500"
        >
          <option value="">All stores</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id}
            </option>
          ))}
        </select>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-ink-100 outline-none focus:border-accent-500"
        >
          <option value="">All modes</option>
          <option value="live">Live</option>
          <option value="test">Test</option>
        </select>
        <span className="text-xs text-ink-500">
          Since {stats ? new Date(stats.since).toLocaleString() : "…"}
        </span>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      {loading && !stats && (
        <p className="text-ink-400">Loading…</p>
      )}

      {stats && (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Total" value={totalPayments} />
            <MetricCard label="Approved" value={approvedCount} color="text-emerald-400" />
            <MetricCard label="Failed" value={failedCount} color="text-red-400" />
            <MetricCard label="Success Rate" value={`${successRate}%`} color="text-accent-400" />
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Pending" value={pendingCount} color="text-amber-400" />
            <MetricCard
              label="Outbox Pending"
              value={stats.outbox_pending}
              color={stats.outbox_pending > 0 ? "text-amber-400" : undefined}
            />
            <MetricCard
              label="Dead Lettered"
              value={stats.outbox_dead_lettered}
              color={stats.outbox_dead_lettered > 0 ? "text-red-400" : undefined}
            />
            <MetricCard
              label="Webhook Sig Failures"
              value={stats.webhook_signature_failures}
              color={stats.webhook_signature_failures > 0 ? "text-red-400" : undefined}
            />
          </div>

          {/* Gateway errors + Payments by state */}
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            {/* Payments by state */}
            <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
              <h2 className="mb-4 text-sm font-medium text-ink-200">Payments by State</h2>
              {totalPayments === 0 ? (
                <p className="text-sm text-ink-400">No payments in this window.</p>
              ) : (
                <div className="space-y-2.5">
                  {Object.entries(stats.payments_by_state)
                    .sort((a, b) => b[1] - a[1])
                    .map(([state, count]) => {
                      const pct = (count / totalPayments) * 100;
                      return (
                        <div key={state}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-ink-300">{state}</span>
                            <span className="text-ink-400">
                              {count}{" "}
                              <span className="text-ink-500">({pct.toFixed(1)}%)</span>
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-ink-800">
                            <div
                              className={`h-full rounded-full transition-all ${STATE_COLORS[state] ?? "bg-ink-500"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Amount by currency */}
            <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
              <h2 className="mb-4 text-sm font-medium text-ink-200">Approved Amount by Currency</h2>
              {Object.keys(stats.approved_amount_minor_by_currency).length === 0 ? (
                <p className="text-sm text-ink-400">No approved amounts in this window.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(stats.approved_amount_minor_by_currency)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cur, amt]) => {
                      const exp = ["KWD", "BHD", "OMR"].includes(cur) ? 3 : cur === "JPY" ? 0 : 2;
                      const display = (amt / 10 ** exp).toFixed(exp);
                      return (
                        <div key={cur} className="flex items-center justify-between">
                          <span className="text-sm text-ink-300">{cur}</span>
                          <span className="font-mono text-sm text-ink-100">
                            {display} {cur}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* System health */}
          <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
            <h2 className="mb-4 text-sm font-medium text-ink-200">System Health</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <HealthCard
                label="Gateway Call Errors"
                value={stats.gateway_call_errors}
                severity={stats.gateway_call_errors > 100 ? "danger" : stats.gateway_call_errors > 10 ? "warning" : "success"}
              />
              <HealthCard
                label="Webhook Sig Failures"
                value={stats.webhook_signature_failures}
                severity={stats.webhook_signature_failures > 5 ? "danger" : stats.webhook_signature_failures > 0 ? "warning" : "success"}
              />
              <HealthCard
                label="Dead Lettered Events"
                value={stats.outbox_dead_lettered}
                severity={stats.outbox_dead_lettered > 50 ? "danger" : stats.outbox_dead_lettered > 0 ? "warning" : "success"}
              />
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900 px-4 py-3">
      <p className="text-xs text-ink-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color ?? "text-ink-100"}`}>{value}</p>
    </div>
  );
}

function HealthCard({
  label,
  value,
  severity,
}: {
  label: string;
  value: number;
  severity: "success" | "warning" | "danger";
}) {
  const colors = {
    success: "border-emerald-500/30 bg-emerald-500/5",
    warning: "border-amber-500/30 bg-amber-500/5",
    danger: "border-red-500/30 bg-red-500/5",
  };
  const textColors = {
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
  };
  const dotColors = {
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    danger: "bg-red-400",
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${colors[severity]}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dotColors[severity]}`} />
        <p className="text-xs text-ink-400">{label}</p>
      </div>
      <p className={`mt-2 text-2xl font-semibold ${textColors[severity]}`}>{value}</p>
    </div>
  );
}
