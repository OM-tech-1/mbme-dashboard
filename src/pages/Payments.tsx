import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { formatAmount, formatDate, Modal, ModeBadge, StateBadge } from "../components/ui";
import { ApiError, getPayment, listPayments, PaymentDetail, PaymentFilters, PaymentSummary } from "../lib/api";

const MODE_FILTER_KEY = "mbme_dashboard_mode_filter";

export default function Payments() {
  const [items, setItems] = useState<PaymentSummary[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PaymentFilters>({
    mode: (localStorage.getItem(MODE_FILTER_KEY) as string) || "live",
  });
  const [detailId, setDetailId] = useState<string | null>(null);

  async function load(f: PaymentFilters, append = false) {
    try {
      const res = await listPayments(f);
      setItems((prev) => (append && prev ? [...prev, ...res.items] : res.items));
      setNextCursor(res.next_cursor);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load payments.");
    }
  }

  useEffect(() => {
    setItems(null);
    load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.store_id, filters.state, filters.currency, filters.q, filters.mode]);

  function applyFilterForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const mode = (fd.get("mode") as string) || undefined;
    if (mode !== undefined) localStorage.setItem(MODE_FILTER_KEY, mode);
    setFilters({
      store_id: (fd.get("store_id") as string) || undefined,
      state: (fd.get("state") as string) || undefined,
      currency: (fd.get("currency") as string) || undefined,
      mode,
      q: (fd.get("q") as string) || undefined,
    });
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink-100">Payments</h1>
        <p className="mt-1 text-sm text-ink-300">
          Every payment intent across every store. Read-only here — fulfilment is the webhook's job, not
          the dashboard's.
        </p>
      </div>

      <form onSubmit={applyFilterForm} className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          placeholder="Order ref or opaque ref"
          className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-ink-100 outline-none placeholder:text-ink-400 focus:border-accent-500"
        />
        <input
          name="store_id"
          placeholder="Store ID"
          className="w-32 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-ink-100 outline-none placeholder:text-ink-400 focus:border-accent-500"
        />
        <select
          name="state"
          className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-ink-100 outline-none focus:border-accent-500"
        >
          <option value="">Any state</option>
          {["CREATED", "LINK_ISSUED", "REDIRECTED", "PENDING", "APPROVED", "FAILED", "EXPIRED", "REFUND_PENDING", "REFUNDED", "PARTIALLY_REFUNDED"].map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ),
          )}
        </select>
        <input
          name="currency"
          placeholder="Currency"
          className="w-24 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-ink-100 outline-none placeholder:text-ink-400 focus:border-accent-500"
        />
        <select
          name="mode"
          defaultValue={filters.mode ?? ""}
          className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-ink-100 outline-none focus:border-accent-500"
        >
          <option value="">All modes</option>
          <option value="live">Live</option>
          <option value="test">Test</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-ink-700 px-4 py-1.5 text-sm font-medium text-ink-100 transition hover:bg-ink-600"
        >
          Filter
        </button>
      </form>

      {error && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3 font-medium">Order ref</th>
              <th className="px-5 py-3 font-medium">Store</th>
              <th className="px-5 py-3 font-medium">Mode</th>
              <th className="px-5 py-3 font-medium">Amount</th>
              <th className="px-5 py-3 font-medium">State</th>
              <th className="px-5 py-3 font-medium">Attempts</th>
              <th className="px-5 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {items === null && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-ink-400">
                  Loading…
                </td>
              </tr>
            )}
            {items?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-ink-400">
                  No payments match.
                </td>
              </tr>
            )}
            {items?.map((p) => (
              <tr
                key={p.id}
                onClick={() => setDetailId(p.id)}
                className="cursor-pointer border-b border-ink-800 last:border-0 hover:bg-ink-800/50"
              >
                <td className="px-5 py-3.5 font-mono text-ink-100">{p.merchant_order_ref}</td>
                <td className="px-5 py-3.5 text-ink-300">{p.store_id}</td>
                <td className="px-5 py-3.5"><ModeBadge mode={p.mode} /></td>
                <td className="px-5 py-3.5 text-ink-300">{formatAmount(p.amount_minor, p.currency)}</td>
                <td className="px-5 py-3.5">
                  <StateBadge state={p.state} />
                </td>
                <td className="px-5 py-3.5 text-ink-300">{p.attempts}</td>
                <td className="px-5 py-3.5 text-ink-400">{formatDate(p.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => load({ ...filters, cursor: nextCursor }, true)}
            className="rounded-lg px-4 py-2 text-sm text-ink-300 transition hover:bg-ink-800"
          >
            Load more
          </button>
        </div>
      )}

      {detailId && <PaymentDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </Layout>
  );
}

function PaymentDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<PaymentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPayment(id)
      .then(setDetail)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load payment."));
  }, [id]);

  return (
    <Modal onClose={onClose} wide>
      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
      {!detail && !error && <p className="text-ink-400">Loading…</p>}
      {detail && (
        <>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink-100">{detail.payment.merchant_order_ref}</h2>
              <p className="mt-1 font-mono text-xs text-ink-400">{detail.payment.opaque_ref}</p>
            </div>
            <div className="flex items-center gap-2">
              <ModeBadge mode={detail.payment.mode} />
              <StateBadge state={detail.payment.state} />
            </div>
          </div>

          <dl className="mb-6 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-ink-400">Store</dt>
              <dd className="text-ink-100">{detail.payment.store_id}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Amount</dt>
              <dd className="text-ink-100">{formatAmount(detail.payment.amount_minor, detail.payment.currency)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Return path</dt>
              <dd className="font-mono text-ink-100">{detail.return_path}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Created</dt>
              <dd className="text-ink-100">{formatDate(detail.payment.created_at)}</dd>
            </div>
          </dl>

          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">
            Attempts ({detail.attempts.length})
          </h3>
          <div className="mb-6 space-y-2">
            {detail.attempts.map((a) => (
              <div key={a.id} className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-ink-300">{a.oid}</span>
                  <StateBadge state={a.state} />
                </div>
                {a.gateway_ref && <p className="mt-1 text-xs text-ink-400">gateway ref: {a.gateway_ref}</p>}
              </div>
            ))}
          </div>

          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">State timeline</h3>
          <div className="space-y-1.5 text-sm">
            {detail.transitions.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-ink-300">
                <span className="text-xs text-ink-500">{formatDate(t.at)}</span>
                {t.from && <span className="text-ink-500">{t.from} →</span>}
                <span className="font-medium text-ink-100">{t.to}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
