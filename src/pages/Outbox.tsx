import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { Badge } from "../components/ui";
import { ApiError, listOutbox, OutboxItem, retryOutbox } from "../lib/api";

export default function Outbox() {
  const [items, setItems] = useState<OutboxItem[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [deadOnly, setDeadOnly] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  async function load(cursor?: string, append = false) {
    try {
      const res = await listOutbox({ dead_lettered: deadOnly ? "true" : undefined, cursor });
      setItems((prev) => (append && prev ? [...prev, ...res.items] : res.items));
      setNextCursor(res.next_cursor);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load outbox.");
    }
  }

  useEffect(() => {
    setItems(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadOnly]);

  async function handleRetry(item: OutboxItem) {
    setRetrying(item.id);
    try {
      await retryOutbox(item.id);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Retry failed.");
    } finally {
      setRetrying(null);
    }
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink-100">Outbox</h1>
        <p className="mt-1 text-sm text-ink-300">
          Deliveries to ecommerce backends. Retry is safe to press — the receiving store dedupes on
          event_id.
        </p>
      </div>

      <label className="mb-4 flex w-fit items-center gap-2 text-sm text-ink-300">
        <input
          type="checkbox"
          checked={deadOnly}
          onChange={(e) => setDeadOnly(e.target.checked)}
          className="h-4 w-4 rounded border-ink-600 bg-ink-800 accent-accent-500"
        />
        Dead-lettered only
      </label>

      {error && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3 font-medium">Store</th>
              <th className="px-5 py-3 font-medium">Event</th>
              <th className="px-5 py-3 font-medium">Attempts</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Last error</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {items === null && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-ink-400">
                  Loading…
                </td>
              </tr>
            )}
            {items?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-ink-400">
                  Nothing here.
                </td>
              </tr>
            )}
            {items?.map((o) => (
              <tr key={o.id} className="border-b border-ink-800 last:border-0 hover:bg-ink-800/50">
                <td className="px-5 py-3.5 font-mono text-ink-100">{o.store_id}</td>
                <td className="px-5 py-3.5 text-ink-300">{o.event_type}</td>
                <td className="px-5 py-3.5 text-ink-300">{o.attempts}</td>
                <td className="px-5 py-3.5">
                  <Badge tone={o.dead_lettered ? "danger" : "success"}>
                    {o.dead_lettered ? "dead-lettered" : "delivering"}
                  </Badge>
                </td>
                <td className="max-w-[260px] truncate px-5 py-3.5 text-xs text-ink-400" title={o.last_error}>
                  {o.last_error ?? "—"}
                </td>
                <td className="px-5 py-3.5 text-right">
                  {o.dead_lettered && (
                    <button
                      onClick={() => handleRetry(o)}
                      disabled={retrying === o.id}
                      className="rounded-md px-2.5 py-1 text-xs font-medium text-ink-300 transition hover:bg-ink-700 hover:text-ink-100 disabled:opacity-50"
                    >
                      {retrying === o.id ? "Retrying…" : "Retry"}
                    </button>
                  )}
                </td>
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
