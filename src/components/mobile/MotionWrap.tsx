"use client";

import type { ReactNode } from "react";

type MotionWrapProps = {
  children: ReactNode;
  className?: string;
};

export function MotionWrap({ children, className = "" }: MotionWrapProps) {
  return <div className={`page-enter ${className}`.trim()}>{children}</div>;
}
