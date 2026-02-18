"use client";

type BadgeProps = {
  text: string;
  tone?: "neutral" | "primary" | "accent" | "success" | "danger";
  pulse?: boolean;
};

const toneClasses: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "border-zinc-200 bg-zinc-100 text-zinc-600",
  primary: "border-blue-200 bg-blue-50 text-blue-700",
  accent: "border-amber-200 bg-amber-50 text-amber-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
};

const dotColors: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-zinc-400",
  primary: "bg-blue-500",
  accent: "bg-amber-500",
  success: "bg-emerald-500",
  danger: "bg-rose-500",
};

export function Badge({ text, tone = "neutral", pulse }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}>
      {pulse ? (
        <span className="relative flex h-2 w-2">
          <span className={`pulse-dot absolute inset-0 rounded-full ${dotColors[tone]} opacity-75`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColors[tone]}`} />
        </span>
      ) : null}
      {text}
    </span>
  );
}
