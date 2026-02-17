"use client";

interface Props {
    activeNav: string;
    scrollTo: (id: string) => void;
}

const NAV_ITEMS = [
    { id: "hero", label: "Trang chủ", icon: "🏠" },
    { id: "pricing", label: "Học phí", icon: "💰" },
    { id: "roadmap", label: "Lộ trình", icon: "🗺️" },
    { id: "dang-ky", label: "Đăng ký", icon: "📝" },
];

export default function BottomNav({ activeNav, scrollTo }: Props) {
    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200/60 bg-white/90 backdrop-blur-lg md:hidden">
            <div className="mx-auto grid max-w-sm grid-cols-4">
                {NAV_ITEMS.map((item) => {
                    const active = activeNav === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => scrollTo(item.id)}
                            className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition ${active ? "text-amber-600" : "text-slate-400"
                                }`}
                        >
                            <span className="text-base">{item.icon}</span>
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
