import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { Badge, formatDate, Modal, StateBadge } from "../components/ui";
import { ApiError, getWebhook, listWebhooks, WebhookDetail, WebhookSummary } from "../lib/api";

export default function Webhooks() {
  const [items, setItems] = useState<WebhookSummary[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [invalidOnly, setInvalidOnly] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  async function load(cursor?: string, append = false) {
    try {
      const res = await listWebhooks({ invalid_only: invalidOnly ? "true" : undefined, cursor });
      setItems((prev) => (append && prev ? [...prev, ...res.items] : res.items));
      setNextCursor(res.next_cursor);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load webhooks.");
    }
  }

  useEffect(() => {
    setItems(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidOnly]);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink-100">Webhooks</h1>
        <p className="mt-1 text-sm text-ink-300">
          Inbound gateway webhooks. A non-zero "invalid only" count is a signature-verification alert
          condition, not routine noise.
        </p>
      </div>

      <label className="mb-4 flex w-fit items-center gap-2 text-sm text-ink-300">
        <input
          type="checkbox"
          checked={invalidOnly}
          onChange={(e) => setInvalidOnly(e.target.checked)}
          className="h-4 w-4 rounded border-ink-600 bg-ink-800 accent-accent-500"
        />
        Invalid signature only
      </label>

      {error && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3 font-medium">OID</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Signature</th>
              <th className="px-5 py-3 font-medium">Received</th>
            </tr>
          </thead>
          <tbody>
            {items === null && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-ink-400">
                  Loading…
                </td>
              </tr>
            )}
            {items?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-ink-400">
                  No webhooks match.
                </td>
              </tr>
            )}
            {items?.map((w) => (
              <tr
                key={w.id}
                onClick={() => setDetailId(w.id)}
                className="cursor-pointer border-b border-ink-800 last:border-0 hover:bg-ink-800/50"
              >
                <td className="px-5 py-3.5 font-mono text-xs text-ink-100">{w.oid}</td>
                <td className="px-5 py-3.5">
                  <StateBadge state={w.status} />
                </td>
                <td className="px-5 py-3.5">
                  <Badge tone={w.signature_valid ? "success" : "danger"}>
                    {w.signature_valid ? "valid" : "invalid"}
                  </Badge>
                </td>
                <td className="px-5 py-3.5 text-ink-400">{formatDate(w.received_at)}</td>
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

      {detailId && <WebhookModal id={detailId} onClose={() => setDetailId(null)} />}
    </Layout>
  );
}

function WebhookModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<WebhookDetail | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getWebhook(id, revealed)
      .then(setDetail)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load webhook."));
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
              {revealed ? "Hide raw body" : "Reveal raw body"}
            </button>
          </div>
          {revealed && (
            <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              This reveal is recorded in the audit log.
            </p>
          )}
          <pre className="max-h-96 overflow-auto rounded-lg border border-ink-700 bg-ink-800 p-3 text-xs text-ink-200">
            {JSON.stringify(detail.body, null, 2)}
          </pre>
        </>
      )}
    </Modal>
  );
}
