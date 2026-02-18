"use client";

interface Props {
    activeNav: string;
    scrollTo: (id: string) => void;
}

/* Minimalist SVG icons – clean lines, 24×24 viewBox */
function IconHome({ active }: { active: boolean }) {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10.5L12 3l9 7.5" />
            <path d="M5 10v9a1 1 0 001 1h3v-5a1 1 0 011-1h4a1 1 0 011 1v5h3a1 1 0 001-1v-9" />
        </svg>
    );
}

function IconWallet({ active }: { active: boolean }) {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="14" rx="2" />
            <path d="M2 10h20" />
            <circle cx="16" cy="14" r="1.5" fill="currentColor" stroke="none" />
        </svg>
    );
}

function IconRoute({ active }: { active: boolean }) {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="19" r="3" />
            <circle cx="18" cy="5" r="3" />
            <path d="M6 16V8a4 4 0 014-4h0a4 4 0 014 4v8a4 4 0 004 4" />
        </svg>
    );
}

function IconRegister({ active }: { active: boolean }) {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="2" width="14" height="20" rx="2" />
            <path d="M8 7h6" />
            <path d="M8 11h6" />
            <path d="M8 15h4" />
            <path d="M14 15l1.5 1.5L18 14" />
        </svg>
    );
}

const NAV_ITEMS = [
    { id: "hero", label: "Trang chủ", Icon: IconHome },
    { id: "pricing", label: "Học phí", Icon: IconWallet },
    { id: "roadmap", label: "Lộ trình", Icon: IconRoute },
    { id: "dang-ky", label: "Đăng ký", Icon: IconRegister },
];

export default function BottomNav({ activeNav, scrollTo }: Props) {
    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
            style={{
                background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)",
                boxShadow: "0 -4px 20px rgba(251,191,36,0.3)",
                borderTop: "1px solid rgba(255,255,255,0.2)",
            }}
        >
            <div className="mx-auto grid max-w-md grid-cols-4">
                {NAV_ITEMS.map((item) => {
                    const active = activeNav === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => scrollTo(item.id)}
                            className="relative flex flex-col items-center gap-1 py-2.5 transition-all duration-200"
                            style={{
                                color: active ? "#ffffff" : "rgba(255,255,255,0.6)",
                            }}
                        >
                            {/* Active glow indicator */}
                            {active && (
                                <span
                                    className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-b-full"
                                    style={{
                                        background: "linear-gradient(90deg, transparent, #ffffff, transparent)",
                                        boxShadow: "0 2px 10px rgba(255,255,255,0.4)",
                                    }}
                                />
                            )}
                            <span
                                className="transition-transform duration-200"
                                style={{
                                    transform: active ? "scale(1.15)" : "scale(1)",
                                    filter: active ? "drop-shadow(0 1px 4px rgba(255,255,255,0.4))" : "none",
                                }}
                            >
                                <item.Icon active={active} />
                            </span>
                            <span
                                className="text-[10px] font-semibold tracking-wide"
                                style={{
                                    color: active ? "#ffffff" : "rgba(255,255,255,0.55)",
                                }}
                            >
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}

