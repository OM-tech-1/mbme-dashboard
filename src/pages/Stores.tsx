import { FormEvent, useEffect, useState } from "react";
import Layout from "../components/Layout";
import { Badge, Field, inputClass, Modal } from "../components/ui";
import {
  ApiError,
  createStore,
  deactivateStore,
  getStats,
  listStores,
  purgeStore,
  rotateSecret,
  Stats,
  StoreView,
  updateStore,
} from "../lib/api";

export default function Stores() {
  const [stores, setStores] = useState<StoreView[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<StoreView | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<{ storeId: string; secret: string } | null>(null);

  async function refresh() {
    try {
      const res = await listStores();
      setStores(res.items);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load stores.");
    }
  }

  useEffect(() => {
    refresh();
    getStats("24h").then(setStats).catch(() => {});
  }, []);

  async function toggleActive(store: StoreView) {
    if (store.active) {
      if (!confirm(`Deactivate "${store.id}"? New payment attempts for this store will stop.`)) return;
      await deactivateStore(store.id);
    } else {
      await updateStore(store.id, { active: true });
    }
    refresh();
  }

  async function handleRotate(store: StoreView) {
    if (
      !confirm(
        `Rotate the HMAC secret for "${store.id}"?\n\nThis is NOT zero-downtime — requests signed with the ` +
          `old secret are rejected the instant this completes. Coordinate with whoever owns that store's backend first.`,
      )
    )
      return;
    const res = await rotateSecret(store.id);
    setRevealedSecret({ storeId: store.id, secret: res.hmac_secret });
    refresh();
  }

  async function handlePurge(store: StoreView) {
    if (
      !confirm(
        `Permanently delete "${store.id}"?\n\nThis is NOT the same as deactivating — the row is gone, ` +
          `irreversibly. Only do this for a store that never had real traffic.`,
      )
    )
      return;
    try {
      await purgeStore(store.id, false);
      refresh();
    } catch (e) {
      if (e instanceof ApiError && e.code === "has_payment_history") {
        if (!confirm(`${e.message}\n\nDelete anyway? Those payment records will be orphaned.`)) return;
        await purgeStore(store.id, true);
        refresh();
      } else {
        setError(e instanceof ApiError ? e.message : "Could not delete store.");
      }
    }
  }

  return (
    <Layout>
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Approved (24h)" value={String(stats.payments_by_state["APPROVED"] ?? 0)} />
          <StatTile label="Failed (24h)" value={String(stats.payments_by_state["FAILED"] ?? 0)} />
          <StatTile
            label="Outbox pending"
            value={String(stats.outbox_pending)}
            warn={stats.outbox_dead_lettered > 0}
          />
          <StatTile
            label="Webhook sig. failures"
            value={String(stats.webhook_signature_failures)}
            warn={stats.webhook_signature_failures > 0}
          />
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-100">Stores</h1>
          <p className="mt-1 text-sm text-ink-300">
            Store configuration and HMAC secrets. Changes to return origin / events URL take effect
            immediately; secret rotation is not zero-downtime.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-600"
        >
          + New store
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-xs uppercase tracking-wide text-ink-400">
              <th className="px-5 py-3 font-medium">Store</th>
              <th className="px-5 py-3 font-medium">Return origin</th>
              <th className="px-5 py-3 font-medium">Events URL</th>
              <th className="px-5 py-3 font-medium">Secret</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {stores === null && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-ink-400">
                  Loading…
                </td>
              </tr>
            )}
            {stores?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-ink-400">
                  No stores yet.
                </td>
              </tr>
            )}
            {stores?.map((s) => (
              <tr key={s.id} className="border-b border-ink-800 last:border-0 hover:bg-ink-800/50">
                <td className="px-5 py-3.5 font-mono text-ink-100">
                  {s.id}
                  {s.mirror_to_store_id && (
                    <span className="ml-2 text-xs font-sans text-ink-400">→ {s.mirror_to_store_id}</span>
                  )}
                </td>
                <td className="max-w-[220px] truncate px-5 py-3.5 text-ink-300" title={s.return_origin}>
                  {s.return_origin}
                </td>
                <td className="max-w-[220px] truncate px-5 py-3.5 text-ink-300" title={s.events_url}>
                  {s.events_url}
                </td>
                <td className="px-5 py-3.5 font-mono text-xs text-ink-400">{s.hmac_secret_fp}</td>
                <td className="px-5 py-3.5">
                  <button onClick={() => toggleActive(s)}>
                    <Badge tone={s.active ? "success" : "neutral"}>{s.active ? "Active" : "Inactive"}</Badge>
                  </button>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditing(s)}
                      className="rounded-md px-2.5 py-1 text-xs font-medium text-ink-300 transition hover:bg-ink-700 hover:text-ink-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleRotate(s)}
                      className="rounded-md px-2.5 py-1 text-xs font-medium text-ink-300 transition hover:bg-ink-700 hover:text-ink-100"
                    >
                      Rotate secret
                    </button>
                    <button
                      onClick={() => handlePurge(s)}
                      className="rounded-md px-2.5 py-1 text-xs font-medium text-red-400/80 transition hover:bg-red-500/10 hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <StoreFormModal
          title="New store"
          onClose={() => setShowCreate(false)}
          onSubmit={async (values) => {
            const res = await createStore(values);
            setShowCreate(false);
            setRevealedSecret({ storeId: res.store.id, secret: res.hmac_secret });
            refresh();
          }}
        />
      )}

      {editing && (
        <StoreFormModal
          title={`Edit "${editing.id}"`}
          initial={editing}
          otherStoreIds={(stores ?? []).map((s) => s.id).filter((id) => id !== editing.id)}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            await updateStore(editing.id, {
              return_origin: values.return_origin,
              events_url: values.events_url,
              path_template: values.path_template,
              mirror_to_store_id: values.mirror_to_store_id ?? "",
            });
            setEditing(null);
            refresh();
          }}
        />
      )}

      {revealedSecret && (
        <SecretModal
          storeId={revealedSecret.storeId}
          secret={revealedSecret.secret}
          onClose={() => setRevealedSecret(null)}
        />
      )}
    </Layout>
  );
}

function StatTile({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 px-4 py-3">
      <p className="text-xs text-ink-400">{label}</p>
      <p className={"mt-1 text-xl font-semibold " + (warn ? "text-amber-400" : "text-ink-100")}>{value}</p>
    </div>
  );
}

interface StoreFormValues {
  id: string;
  return_origin: string;
  events_url: string;
  path_template?: string;
  mirror_to_store_id?: string;
}

function StoreFormModal({
  title,
  initial,
  otherStoreIds,
  onSubmit,
  onClose,
}: {
  title: string;
  initial?: StoreView;
  otherStoreIds?: string[];
  onSubmit: (values: StoreFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [id, setId] = useState(initial?.id ?? "");
  const [returnOrigin, setReturnOrigin] = useState(initial?.return_origin ?? "");
  const [eventsUrl, setEventsUrl] = useState(initial?.events_url ?? "");
  const [pathTemplate, setPathTemplate] = useState(initial?.path_template ?? "/order/{ref}");
  const [mirrorTo, setMirrorTo] = useState(initial?.mirror_to_store_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit({
        id,
        return_origin: returnOrigin,
        events_url: eventsUrl,
        path_template: pathTemplate,
        // Only meaningful on edit — omitted on create so the request body
        // doesn't carry a field CreateStoreInput doesn't even declare.
        ...(initial ? { mirror_to_store_id: mirrorTo } : {}),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="mb-4 text-base font-semibold text-ink-100">{title}</h2>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Store ID">
          <input
            className={inputClass + (initial ? " opacity-60" : "")}
            value={id}
            onChange={(e) => setId(e.target.value.toLowerCase())}
            placeholder="acme"
            pattern="^[a-z0-9][a-z0-9_\-]{0,31}$"
            disabled={!!initial}
            required
          />
        </Field>
        <Field label="Return origin">
          <input
            className={inputClass}
            value={returnOrigin}
            onChange={(e) => setReturnOrigin(e.target.value)}
            placeholder="https://store.example.com"
            type="url"
            required
          />
        </Field>
        <Field label="Events URL">
          <input
            className={inputClass}
            value={eventsUrl}
            onChange={(e) => setEventsUrl(e.target.value)}
            placeholder="https://api.store.example.com/webhooks/external-payment"
            type="url"
            required
          />
        </Field>
        <Field label="Path template">
          <input
            className={inputClass}
            value={pathTemplate}
            onChange={(e) => setPathTemplate(e.target.value)}
            placeholder="/order/{ref}"
          />
        </Field>

        {initial && otherStoreIds && (
          <Field label="Mirror outbox events to">
            <select className={inputClass} value={mirrorTo} onChange={(e) => setMirrorTo(e.target.value)}>
              <option value="">None</option>
              {otherStoreIds.map((sid) => (
                <option key={sid} value={sid}>
                  {sid}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-ink-400">
              One-way, opt-in: every state-change event for "{initial.id}"'s orders also delivers to the
              selected store, read-only. Only set this for a confirmed business relationship — see
              CLAUDE.md invariant 10.
            </p>
          </Field>
        )}

        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
        {!initial && (
          <p className="text-xs text-ink-400">
            A new store is created active immediately. If the real URLs above aren't final yet, deactivate
            it right after creating — a real payment against a placeholder URL fails silently for the
            customer.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-ink-300 transition hover:bg-ink-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-600 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SecretModal({
  storeId,
  secret,
  onClose,
}: {
  storeId: string;
  secret: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  function copy() {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Modal onClose={() => acknowledged && onClose()}>
      <h2 className="mb-1 text-base font-semibold text-ink-100">HMAC secret for "{storeId}"</h2>
      <p className="mb-4 text-sm text-ink-300">
        Shown once. It cannot be retrieved again — only rotated. Deliver it over a secure channel, never
        plain email or chat history.
      </p>
      <div className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2.5">
        <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm text-emerald-400">
          {secret}
        </code>
        <button
          onClick={copy}
          className="shrink-0 rounded-md bg-ink-700 px-2.5 py-1 text-xs font-medium text-ink-100 transition hover:bg-ink-600"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-ink-300">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="h-4 w-4 rounded border-ink-600 bg-ink-800 accent-accent-500"
        />
        I've copied this secret somewhere secure
      </label>

      <div className="mt-4 flex justify-end">
        <button
          onClick={onClose}
          disabled={!acknowledged}
          className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Done
        </button>
      </div>
    </Modal>
  );
}
