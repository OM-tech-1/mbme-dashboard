import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { Badge, formatDate, Modal, ModeBadge } from "../components/ui";
import { ApiError, GatewayCallDetail, GatewayCallSummary, getGatewayCall, listGatewayCalls } from "../lib/api";

const MODE_FILTER_KEY = "mbme_dashboard_gw_mode_filter";

export default function GatewayCalls() {
  const [items, setItems] = useState<GatewayCallSummary[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [modeFilter, setModeFilter] = useState<string>(() => localStorage.getItem(MODE_FILTER_KEY) || "live");
  const [detailId, setDetailId] = useState<string | null>(null);

  async function load(cursor?: string, append = false) {
    try {
      const res = await listGatewayCalls({ errors_only: errorsOnly ? "true" : undefined, mode: modeFilter || undefined, cursor });
      setItems((prev) => (append && prev ? [...prev, ...res.items] : res.items));
      setNextCursor(res.next_cursor);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load gateway calls.");
    }
  }

  useEffect(() => {
    setItems(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorsOnly, modeFilter]);

  function handleModeChange(value: string) {
    setModeFilter(value);
    localStorage.setItem(MODE_FILTER_KEY, value);
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink-100">Gateway calls</h1>
        <p className="mt-1 text-sm text-ink-300">Every request this module made to MBME.</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex w-fit items-center gap-2 text-sm text-ink-300">
          <input
            type="checkbox"
            checked={errorsOnly}
            onChange={(e) => setErrorsOnly(e.target.checked)}
            className="h-4 w-4 rounded border-ink-600 bg-ink-800 accent-accent-500"
          />
          Errors only
        </label>
        <select
          value={modeFilter}
          onChange={(e) => handleModeChange(e.target.value)}
          className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-ink-100 outline-none focus:border-accent-500"
        >
          <option value="">All modes</option>
          <option value="live">Live</option>
          <option value="test">Test</option>
        </select>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3 font-medium">OID</th>
              <th className="px-5 py-3 font-medium">Purpose</th>
              <th className="px-5 py-3 font-medium">Mode</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Time</th>
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
                  No gateway calls match.
                </td>
              </tr>
            )}
            {items?.map((c) => (
              <tr
                key={c.id}
                onClick={() => setDetailId(c.id)}
                className="cursor-pointer border-b border-ink-800 last:border-0 hover:bg-ink-800/50"
              >
                <td className="px-5 py-3.5 font-mono text-xs text-ink-100">{c.oid}</td>
                <td className="px-5 py-3.5 text-ink-300">{c.purpose}</td>
                <td className="px-5 py-3.5"><ModeBadge mode={c.mode} /></td>
                <td className="px-5 py-3.5">
                  <Badge tone={c.error || (c.status_code ?? 0) >= 400 ? "danger" : "success"}>
                    {c.error ? "error" : (c.status_code ?? "—")}
                  </Badge>
                </td>
                <td className="px-5 py-3.5 text-ink-400">{formatDate(c.called_at)}</td>
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

      {detailId && <GatewayCallModal id={detailId} onClose={() => setDetailId(null)} />}
    </Layout>
  );
}

function GatewayCallModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<GatewayCallDetail | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGatewayCall(id, revealed)
      .then(setDetail)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load call."));
  }, [id, revealed]);

  return (
    <Modal onClose={onClose} wide>
      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
      {!detail && !error && <p className="text-ink-400">Loading…</p>}
      {detail && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-mono text-sm text-ink-100">{detail.oid}</h2>
            <button
              onClick={() => setRevealed((r) => !r)}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-ink-300 transition hover:bg-ink-700 hover:text-ink-100"
            >
              {revealed ? "Hide raw payload" : "Reveal raw payload"}
            </button>
          </div>
          {revealed && (
            <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              This reveal is recorded in the audit log.
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-400">Request</h3>
              <pre className="max-h-80 overflow-auto rounded-lg border border-ink-700 bg-ink-800 p-3 text-xs text-ink-200">
                {JSON.stringify(detail.request, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-400">Response</h3>
              <pre className="max-h-80 overflow-auto rounded-lg border border-ink-700 bg-ink-800 p-3 text-xs text-ink-200">
                {JSON.stringify(detail.response, null, 2)}
              </pre>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
