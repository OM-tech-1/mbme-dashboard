import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { formatDate } from "../components/ui";
import { ApiError, AuditEntry, listAudit } from "../lib/api";

export default function Audit() {
  const [items, setItems] = useState<AuditEntry[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  async function load(cursor?: string, append = false) {
    try {
      const res = await listAudit(cursor);
      setItems((prev) => (append && prev ? [...prev, ...res.items] : res.items));
      setNextCursor(res.next_cursor);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load audit log.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink-100">Audit log</h1>
        <p className="mt-1 text-sm text-ink-300">
          Every mutation and every payload reveal, across both admin surfaces, newest first.
        </p>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3 font-medium">Actor</th>
              <th className="px-5 py-3 font-medium">Action</th>
              <th className="px-5 py-3 font-medium">Target</th>
              <th className="px-5 py-3 font-medium">Detail</th>
              <th className="px-5 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {items === null && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-ink-400">
                  Loading…
                </td>
              </tr>
            )}
            {items?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-ink-400">
                  Nothing recorded yet.
                </td>
              </tr>
            )}
            {items?.map((a) => (
              <tr key={a.id} className="border-b border-ink-800 last:border-0 hover:bg-ink-800/50">
                <td className="px-5 py-3.5 text-ink-300">{a.key_name || "—"}</td>
                <td className="px-5 py-3.5 font-mono text-xs text-ink-100">{a.action}</td>
                <td className="px-5 py-3.5 text-ink-300">{a.target}</td>
                <td className="max-w-[280px] truncate px-5 py-3.5 text-xs text-ink-400">
                  {a.detail ? JSON.stringify(a.detail) : "—"}
                </td>
                <td className="px-5 py-3.5 text-ink-400">{formatDate(a.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => load(nextCursor, true)}
            className="rounded-lg px-4 py-2 text-sm text-ink-300 transition hover:bg-ink-800"
          >
            Load more
          </button>
        </div>
      )}
    </Layout>
  );
}
