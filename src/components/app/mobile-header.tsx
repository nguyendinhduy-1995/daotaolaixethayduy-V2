"use client";

import type { ReactNode } from "react";
import { MobileTopbar as SharedMobileTopbar } from "@/components/admin/mobile-topbar";

type MobileHeaderProps = {
  title: string;
  subtitle?: string;
  rightActions?: ReactNode;
};

export function MobileHeader({ title, subtitle, rightActions }: MobileHeaderProps) {
  return <SharedMobileTopbar title={title} subtitle={subtitle} actionNode={rightActions} />;
}
