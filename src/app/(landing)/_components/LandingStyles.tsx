"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/*  CSS Animations                                                     */
/* ------------------------------------------------------------------ */
export const ANIM_CSS = `
@keyframes ld-fade-up {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ld-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes ld-scale-in {
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes ld-slide-right {
  from { opacity: 0; transform: translateX(-20px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes ld-pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.4); }
  50%      { box-shadow: 0 0 0 12px rgba(245,158,11,0); }
}
.ld-fade-up   { animation: ld-fade-up 0.6s ease-out both; }
.ld-fade-in   { animation: ld-fade-in 0.5s ease-out both; }
.ld-scale-in  { animation: ld-scale-in 0.5s ease-out both; }
.ld-slide-r   { animation: ld-slide-right 0.5s ease-out both; }
.ld-pulse     { animation: ld-pulse-glow 2s ease-in-out infinite; }
.ld-d1 { animation-delay:.1s } .ld-d2 { animation-delay:.2s }
.ld-d3 { animation-delay:.3s } .ld-d4 { animation-delay:.4s }
.ld-d5 { animation-delay:.5s } .ld-d6 { animation-delay:.6s }
`;

/* ------------------------------------------------------------------ */
/*  Component: RevealSection – IntersectionObserver wrapper             */
/*  Avoids React 19 react-hooks/refs lint errors.                       */
/* ------------------------------------------------------------------ */
export function RevealSection({
  children,
  className,
  threshold = 0.15,
}: {
  children: (visible: boolean) => ReactNode;
  className?: string;
  threshold?: number;
}) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  const callbackRef = useCallback((node: HTMLDivElement | null) => {
    setEl(node);
  }, []);

  useEffect(() => {
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [el, threshold]);

  return (
    <div ref={callbackRef} className={className}>
      {children(visible)}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
export function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n);
}

export const HOTLINE = "0948 742 666";
export const HOTLINE_TEL = "tel:0948742666";

export const PROVINCES = [
  "Hồ Chí Minh", "Bình Dương", "Đồng Nai", "Tiền Giang",
  "Cần Thơ", "Vĩnh Long", "Sóc Trăng",
];
export const LICENSE_TYPES = [
  "B (số tự động)", "B (số sàn)", "C1",
  "B, C1, C lên D1", "B, C1, C, D1 lên D2", "C, D1, D2 lên D",
  "B lên C", "C1 lên C", "C lên CE",
];

