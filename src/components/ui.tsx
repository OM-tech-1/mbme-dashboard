export const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-400 focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-300">{label}</label>
      {children}
    </div>
  );
}

export function Modal({
  children,
  onClose,
  wide,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className={
          "max-h-[85vh] w-full overflow-y-auto rounded-2xl border border-ink-700 bg-ink-900 p-6 shadow-2xl " +
          (wide ? "max-w-2xl" : "max-w-md")
        }
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

type Tone = "success" | "danger" | "warning" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-emerald-500/10 text-emerald-400",
  danger: "bg-red-500/10 text-red-400",
  warning: "bg-amber-500/10 text-amber-400",
  neutral: "bg-ink-700 text-ink-300",
};

const TONE_DOT: Record<Tone, string> = {
  success: "bg-emerald-400",
  danger: "bg-red-400",
  warning: "bg-amber-400",
  neutral: "bg-ink-400",
};

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium " + TONE_CLASSES[tone]}
    >
      <span className={"h-1.5 w-1.5 rounded-full " + TONE_DOT[tone]} />
      {children}
    </span>
  );
}

// stateTone maps the payment/attempt state vocabulary (CLAUDE.md's state
// machine) to a badge tone. Anything not explicitly listed reads as neutral
// rather than guessing — an unrecognized state is more useful shown plainly
// than colored wrong.
export function stateTone(state: string): Tone {
  switch (state) {
    case "APPROVED":
    case "REFUNDED":
      return "success";
    case "FAILED":
    case "EXPIRED":
      return "danger";
    case "PENDING":
    case "REDIRECTED":
    case "LINK_ISSUED":
    case "REFUND_PENDING":
      return "warning";
    default:
      return "neutral";
  }
}

export function StateBadge({ state }: { state: string }) {
  return <Badge tone={stateTone(state)}>{state}</Badge>;
}

export function formatAmount(minor: number, currency: string): string {
  // Matches the module's own per-currency exponent table (CLAUDE.md) rather
  // than assuming 2 decimals — KWD/BHD/OMR use 3, JPY uses 0.
  const exponent = ["KWD", "BHD", "OMR"].includes(currency) ? 3 : currency === "JPY" ? 0 : 2;
  const value = minor / 10 ** exponent;
  return `${value.toFixed(exponent)} ${currency}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}
