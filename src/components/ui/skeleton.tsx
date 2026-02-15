"use client";

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`animate-shimmer rounded-xl bg-zinc-200/80 ${className}`} />;
}
