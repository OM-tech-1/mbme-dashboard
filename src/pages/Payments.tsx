import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { Badge, formatAmount, formatDate, Modal, ModeBadge, StateBadge } from "../components/ui";
import { ApiError, getGatewayCall, getPayment, getWebhook, listGatewayCalls, listOutbox, listPayments, listWebhooks, PaymentDetail, PaymentFilters, PaymentSummary } from "../lib/api";

const MODE_FILTER_KEY = "mbme_dashboard_mode_filter";

function RowCopyButtons({ refValue, oid }: { refValue: string; oid: string }) {
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedOid, setCopiedOid] = useState(false);

  function handleCopyRef(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(refValue);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 1500);
  }

  function handleCopyOid(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(oid);
    setCopiedOid(true);
    setTimeout(() => setCopiedOid(false), 1500);
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        onClick={handleCopyRef}
        className="rounded bg-ink-600/80 px-2 py-0.5 text-xs font-medium text-ink-200 transition-colors hover:bg-ink-500/80 hover:text-ink-100"
      >
        {copiedRef ? "Copied!" : "Copy Ref"}
      </button>
      <button
        onClick={handleCopyOid}
        className="rounded bg-accent-500/20 px-2 py-0.5 text-xs font-medium text-accent-400 transition-colors hover:bg-accent-500/30"
      >
        {copiedOid ? "Copied!" : "Copy OID"}
      </button>
    </span>
  );
}

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
              <th className="px-5 py-3 font-medium">OID</th>
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
                <td colSpan={8} className="px-5 py-8 text-center text-ink-400">
                  Loading…
                </td>
              </tr>
            )}
            {items?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-ink-400">
                  No payments match.
                </td>
              </tr>
            )}
            {items?.map((p) => (
              <RefRow key={p.id} payment={p} onOpen={() => setDetailId(p.id)} />
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

function RefRow({
  payment,
  onOpen,
}: {
  payment: PaymentSummary;
  onOpen: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <tr
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer border-b border-ink-800 last:border-0 hover:bg-ink-800/50"
    >
      <td className="px-5 py-3.5 font-mono text-ink-100">
        <span className="inline-flex items-center gap-2">
          <span>{payment.merchant_order_ref}</span>
          <span
            className={`inline-flex transition-opacity duration-200 ${
              hovered ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <RowCopyButtons refValue={payment.merchant_order_ref} oid={payment.id} />
          </span>
        </span>
      </td>
      <td className="px-5 py-3.5 font-mono text-xs text-ink-300">{payment.id}</td>
      <td className="px-5 py-3.5 text-ink-300">{payment.store_id}</td>
      <td className="px-5 py-3.5"><ModeBadge mode={payment.mode} /></td>
      <td className="px-5 py-3.5 text-ink-300">{formatAmount(payment.amount_minor, payment.currency)}</td>
      <td className="px-5 py-3.5">
        <StateBadge state={payment.state} />
      </td>
      <td className="px-5 py-3.5 text-ink-300">{payment.attempts}</td>
      <td className="px-5 py-3.5 text-ink-400">{formatDate(payment.updated_at)}</td>
    </tr>
  );
}

function PaymentDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<PaymentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gatewayCalls, setGatewayCalls] = useState<import("../lib/api").GatewayCallSummary[] | null>(null);
  const [webhooks, setWebhooks] = useState<import("../lib/api").WebhookSummary[] | null>(null);
  const [outboxItems, setOutboxItems] = useState<import("../lib/api").OutboxItem[] | null>(null);
  const [activeTab, setActiveTab] = useState<"attempts" | "gateway" | "webhooks" | "outbox">("attempts");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    getPayment(id)
      .then((d) => {
        setDetail(d);
        // Fetch related data using the first attempt's OID
        const oid = d.attempts[0]?.oid;
        if (oid) {
          listGatewayCalls({ oid }).then((r) => setGatewayCalls(r.items)).catch(() => setGatewayCalls([]));
          listWebhooks({ oid }).then((r) => setWebhooks(r.items)).catch(() => setWebhooks([]));
        }
        listOutbox({ store_id: d.payment.store_id })
          .then((r) => {
            const filtered = r.items.filter((o) => {
              if (!o.payload || typeof o.payload !== "object") return false;
              const p = o.payload as Record<string, unknown>;
              return p.merchant_order_ref === d.payment.merchant_order_ref;
            });
            setOutboxItems(filtered);
          })
          .catch(() => setOutboxItems([]));
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load payment."));
  }, [id]);

  const tabs = [
    { key: "attempts" as const, label: "Attempts", count: detail?.attempts.length ?? 0 },
    { key: "gateway" as const, label: "Gateway Calls", count: gatewayCalls?.length ?? 0 },
    { key: "webhooks" as const, label: "Webhooks", count: webhooks?.length ?? 0 },
    { key: "outbox" as const, label: "Outbox", count: outboxItems?.length ?? 0 },
  ];

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

          {/* Tab navigation */}
          <div className="mb-4 flex gap-1 border-b border-ink-700">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-2 text-xs font-medium transition ${
                  activeTab === t.key
                    ? "border-b-2 border-accent-500 text-ink-100"
                    : "text-ink-400 hover:text-ink-200"
                }`}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "attempts" && (
            <div className="space-y-2">
              {detail.attempts.map((a) => (
                <div
                  key={a.id}
                  onClick={() => toggleExpand(a.id)}
                  className="cursor-pointer rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm transition hover:border-ink-600"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-ink-500 text-xs">{expandedIds.has(a.id) ? "▼" : "▶"}</span>
                      <span className="font-mono text-xs text-ink-300">{a.oid}</span>
                    </div>
                    <StateBadge state={a.state} />
                  </div>
                  {a.gateway_ref && <p className="mt-1 text-xs text-ink-400">gateway ref: {a.gateway_ref}</p>}
                  {expandedIds.has(a.id) && (
                    <div className="mt-2 rounded-md border border-ink-600 bg-ink-900 p-2 space-y-1">
                      <div><span className="text-xs text-ink-400">ID: </span><span className="font-mono text-xs text-ink-300">{a.id}</span></div>
                      <div><span className="text-xs text-ink-400">Created: </span><span className="text-xs text-ink-300">{formatDate(a.created_at)}</span></div>
                      <div><span className="text-xs text-ink-400">Updated: </span><span className="text-xs text-ink-300">{formatDate(a.updated_at)}</span></div>
                      <div><span className="text-xs text-ink-400">Payment link: </span><span className="text-xs text-ink-300">{a.has_payment_link ? "Yes" : "No"}</span></div>
                      {a.link_expires_at && <div><span className="text-xs text-ink-400">Link expires: </span><span className="text-xs text-ink-300">{formatDate(a.link_expires_at)}</span></div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === "gateway" && (
            <div className="space-y-2">
              {gatewayCalls === null ? (
                <p className="text-sm text-ink-400">Loading…</p>
              ) : gatewayCalls.length === 0 ? (
                <p className="text-sm text-ink-400">No gateway calls for this OID.</p>
              ) : (
                gatewayCalls.map((c) => (
                  <GatewayCallItem key={c.id} call={c} expanded={expandedIds.has(c.id)} onToggle={() => toggleExpand(c.id)} />
                ))
              )}
            </div>
          )}

          {activeTab === "webhooks" && (
            <div className="space-y-2">
              {webhooks === null ? (
                <p className="text-sm text-ink-400">Loading…</p>
              ) : webhooks.length === 0 ? (
                <p className="text-sm text-ink-400">No webhooks for this OID.</p>
              ) : (
                webhooks.map((w) => (
                  <WebhookItem key={w.id} hook={w} expanded={expandedIds.has(w.id)} onToggle={() => toggleExpand(w.id)} />
                ))
              )}
            </div>
          )}

          {activeTab === "outbox" && (
            <div className="space-y-2">
              {outboxItems === null ? (
                <p className="text-sm text-ink-400">Loading…</p>
              ) : outboxItems.length === 0 ? (
                <p className="text-sm text-ink-400">No outbox items for this store.</p>
              ) : (
                outboxItems.map((o) => (
                  <div
                    key={o.id}
                    onClick={() => toggleExpand(o.id)}
                    className="cursor-pointer rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm transition hover:border-ink-600"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-ink-500 text-xs">{expandedIds.has(o.id) ? "▼" : "▶"}</span>
                        <span className="font-mono text-xs text-ink-300">{o.event_type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {o.dead_lettered && <Badge tone="danger">Dead letter</Badge>}
                        {o.delivered_at ? (
                          <Badge tone="success">Delivered</Badge>
                        ) : (
                          <Badge tone="neutral">Pending</Badge>
                        )}
                      </div>
                    </div>
                    {o.last_error && <p className="mt-1 text-xs text-red-400">{o.last_error}</p>}
                    <p className="mt-1 text-xs text-ink-500">Attempts: {o.attempts} · {formatDate(o.created_at)}</p>
                    {expandedIds.has(o.id) && (
                      <div className="mt-2 rounded-md border border-ink-600 bg-ink-900 p-2">
                        <p className="mb-1 text-xs text-ink-400">Event ID</p>
                        <p className="font-mono text-xs text-ink-300 mb-2">{o.event_id}</p>
                        {o.payload ? (
                          <>
                            <p className="mb-1 text-xs text-ink-400">Payload</p>
                            <pre className="max-h-48 overflow-auto rounded bg-ink-950 p-2 text-xs text-ink-300 whitespace-pre-wrap break-all">
                              {typeof o.payload === "string" ? o.payload : JSON.stringify(o.payload, null, 2)}
                            </pre>
                          </>
                        ) : (
                          <p className="text-xs text-ink-500 italic">No payload</p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          <h3 className="mt-6 mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">State timeline</h3>
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

function GatewayCallItem({
  call,
  expanded,
  onToggle,
}: {
  call: import("../lib/api").GatewayCallSummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [detail, setDetail] = useState<import("../lib/api").GatewayCallDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (expanded && !detail && !loading) {
      setLoading(true);
      getGatewayCall(call.id, true)
        .then(setDetail)
        .catch(() => setDetail(null))
        .finally(() => setLoading(false));
    }
  }, [expanded, detail, loading, call.id]);

  return (
    <div
      onClick={onToggle}
      className="cursor-pointer rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm transition hover:border-ink-600"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-ink-500 text-xs">{expanded ? "▼" : "▶"}</span>
          <span className="font-mono text-xs text-ink-300">{call.purpose}</span>
        </div>
        <div className="flex items-center gap-2">
          {call.status_code && <span className="text-xs text-ink-400">{call.status_code}</span>}
          {call.error && <span className="text-xs text-red-400">{call.error}</span>}
        </div>
      </div>
      <p className="mt-1 text-xs text-ink-500">{formatDate(call.called_at)}</p>
      {expanded && (
        <div className="mt-2 rounded-md border border-ink-600 bg-ink-900 p-2">
          <p className="mb-1 text-xs text-ink-400">ID</p>
          <p className="font-mono text-xs text-ink-300 mb-2">{call.id}</p>
          <p className="mb-1 text-xs text-ink-400">OID</p>
          <p className="font-mono text-xs text-ink-300 mb-2">{call.oid}</p>
          {loading && <p className="text-xs text-ink-400">Loading details…</p>}
          {detail?.request != null && (
            <>
              <p className="mb-1 text-xs text-ink-400">Request</p>
              <pre className="max-h-48 overflow-auto rounded bg-ink-950 p-2 text-xs text-ink-300 whitespace-pre-wrap break-all">
                {typeof detail.request === "string" ? detail.request : JSON.stringify(detail.request, null, 2)}
              </pre>
            </>
          )}
          {detail?.response != null && (
            <>
              <p className="mt-2 mb-1 text-xs text-ink-400">Response</p>
              <pre className="max-h-48 overflow-auto rounded bg-ink-950 p-2 text-xs text-ink-300 whitespace-pre-wrap break-all">
                {typeof detail.response === "string" ? detail.response : JSON.stringify(detail.response, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function WebhookItem({
  hook,
  expanded,
  onToggle,
}: {
  hook: import("../lib/api").WebhookSummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [detail, setDetail] = useState<import("../lib/api").WebhookDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (expanded && !detail && !loading) {
      setLoading(true);
      getWebhook(hook.id, true)
        .then(setDetail)
        .catch(() => setDetail(null))
        .finally(() => setLoading(false));
    }
  }, [expanded, detail, loading, hook.id]);

  return (
    <div
      onClick={onToggle}
      className="cursor-pointer rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm transition hover:border-ink-600"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-ink-500 text-xs">{expanded ? "▼" : "▶"}</span>
          <span className="text-xs text-ink-300">{hook.status ?? "—"}</span>
        </div>
        <Badge tone={hook.signature_valid ? "success" : "danger"}>
          {hook.signature_valid ? "Valid sig" : "Invalid sig"}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-ink-500">{formatDate(hook.received_at)}</p>
      {expanded && (
        <div className="mt-2 rounded-md border border-ink-600 bg-ink-900 p-2">
          <p className="mb-1 text-xs text-ink-400">ID</p>
          <p className="font-mono text-xs text-ink-300 mb-2">{hook.id}</p>
          {hook.oid && <><p className="mb-1 text-xs text-ink-400">OID</p><p className="font-mono text-xs text-ink-300 mb-2">{hook.oid}</p></>}
          {loading && <p className="text-xs text-ink-400">Loading body…</p>}
          {detail?.body != null && (
            <>
              <p className="mb-1 text-xs text-ink-400">Body</p>
              <pre className="max-h-48 overflow-auto rounded bg-ink-950 p-2 text-xs text-ink-300 whitespace-pre-wrap break-all">
                {typeof detail.body === "string" ? detail.body : JSON.stringify(detail.body, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
