"use client";

type SkeletonProps = {
  className?: string;
  /** Preset shapes */
  variant?: "text" | "circle" | "rect";
  /** Custom width */
  width?: string | number;
  /** Custom height */
  height?: string | number;
};

export function Skeleton({ className = "", variant = "text", width, height }: SkeletonProps) {
  const base = "animate-shimmer rounded bg-zinc-200/70";
  const presets: Record<string, string> = {
    text: "h-4 w-full rounded-md",
    circle: "h-10 w-10 rounded-full",
    rect: "h-20 w-full rounded-xl",
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === "number" ? `${width}px` : width;
  if (height) style.height = typeof height === "number" ? `${height}px` : height;

  return <div className={`${base} ${presets[variant]} ${className}`} style={style} />;
}

/** Table loading skeleton */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3 rounded-xl bg-white p-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={c === 0 ? "!w-1/4" : "flex-1"} height={16} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Card loading skeleton */
export function CardSkeleton() {
  return (
    <div className="animate-pulse space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" />
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={12} />
        </div>
      </div>
      <Skeleton variant="rect" height={12} />
      <Skeleton width="80%" height={12} />
    </div>
  );
}

