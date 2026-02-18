"use client";

import {
    createContext,
    useCallback,
    useContext,
    useState,
    useEffect,
    type ReactNode,
} from "react";

/* ── Types ─────────────────────────────────────────────── */
type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; type: ToastType; message: string };

type ToastContextValue = {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
};

const ToastCtx = createContext<ToastContextValue>({
    success: () => { },
    error: () => { },
    info: () => { },
});

export const useToast = () => useContext(ToastCtx);

/* ── Single toast ──────────────────────────────────────── */
function ToastBubble({
    item,
    onRemove,
}: {
    item: ToastItem;
    onRemove: (id: number) => void;
}) {
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        const autoHide = window.setTimeout(() => setExiting(true), 2800);
        return () => window.clearTimeout(autoHide);
    }, []);

    useEffect(() => {
        if (!exiting) return;
        const t = window.setTimeout(() => onRemove(item.id), 280);
        return () => window.clearTimeout(t);
    }, [exiting, item.id, onRemove]);

    const colors: Record<ToastType, { bg: string; border: string; text: string; icon: string; gradient: string }> = {
        success: {
            bg: "bg-emerald-50",
            border: "border-emerald-200",
            text: "text-emerald-800",
            icon: "✅",
            gradient: "from-emerald-500 to-green-500",
        },
        error: {
            bg: "bg-rose-50",
            border: "border-rose-200",
            text: "text-rose-800",
            icon: "❌",
            gradient: "from-rose-500 to-red-500",
        },
        info: {
            bg: "bg-blue-50",
            border: "border-blue-200",
            text: "text-blue-800",
            icon: "ℹ️",
            gradient: "from-blue-500 to-indigo-500",
        },
    };

    const c = colors[item.type];

    return (
        <button
            type="button"
            onClick={() => setExiting(true)}
            className={`
        pointer-events-auto flex w-full max-w-sm items-center gap-2.5
        overflow-hidden rounded-2xl border ${c.border} ${c.bg}
        px-4 py-3 shadow-lg backdrop-blur
        transition-all duration-200
        ${exiting ? "animate-toast-out" : "animate-toast-in"}
      `}
        >
            <div
                className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${c.gradient}`}
            />
            <span className="text-base">{c.icon}</span>
            <span className={`flex-1 text-left text-sm font-medium ${c.text}`}>
                {item.message}
            </span>
            <span className="text-xs text-zinc-400">✕</span>
        </button>
    );
}

/* ── Provider ──────────────────────────────────────────── */
let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const remove = useCallback((id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const push = useCallback((type: ToastType, message: string) => {
        const id = ++toastId;
        setToasts((prev) => [...prev.slice(-4), { id, type, message }]);
    }, []);

    const api = {
        success: (msg: string) => push("success", msg),
        error: (msg: string) => push("error", msg),
        info: (msg: string) => push("info", msg),
    };

    return (
        <ToastCtx.Provider value={api}>
            {children}
            {/* Toast container — top-center, safe-area aware */}
            <div
                className="pointer-events-none fixed inset-x-0 top-0 z-[9999] flex flex-col items-center gap-2 px-4"
                style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
            >
                {toasts.map((t) => (
                    <ToastBubble key={t.id} item={t} onRemove={remove} />
                ))}
            </div>
        </ToastCtx.Provider>
    );
}
