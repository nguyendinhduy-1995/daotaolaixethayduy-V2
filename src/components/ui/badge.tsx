"use client";

type BadgeProps = {
  text: string;
};

export function Badge({ text }: BadgeProps) {
  return (
    <span className="inline-flex rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
      {text}
    </span>
  );
}
