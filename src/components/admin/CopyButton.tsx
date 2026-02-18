"use client";

import { useState, useCallback } from "react";

type CopyButtonProps = {
    text: string;
    label?: string;
    className?: string;
    icon?: string;
};

export function CopyButton({ text, label = "Copy", className = "", icon = "📋" }: CopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [text]);

    return (
        <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 ${copied
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300"
                } ${className}`}
        >
            <span>{copied ? "✅" : icon}</span>
            <span>{copied ? "Đã copy!" : label}</span>
        </button>
    );
}

type DownloadButtonProps = {
    content: string;
    filename: string;
    label?: string;
    className?: string;
};

export function DownloadButton({ content, filename, label = "Download", className = "" }: DownloadButtonProps) {
    const handleDownload = useCallback(() => {
        const blob = new Blob([content], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [content, filename]);

    return (
        <button
            type="button"
            onClick={handleDownload}
            className={`inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-all hover:bg-zinc-50 hover:border-zinc-300 active:scale-95 ${className}`}
        >
            <span>⬇️</span>
            <span>{label}</span>
        </button>
    );
}
