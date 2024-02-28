import clsx from "clsx";

export default function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
        tone === "good" && "border-teal/40 bg-teal/10 text-teal",
        tone === "warn" && "border-copper/40 bg-copper/10 text-copper",
        tone === "bad" && "border-rust/45 bg-rust/10 text-rust",
        tone === "neutral" && "border-line bg-paper text-slate",
      )}
    >
      {label}
    </span>
  );
}
