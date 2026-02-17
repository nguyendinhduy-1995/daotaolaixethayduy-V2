"use client";

import { useEffect, useRef, useState } from "react";
import { ANIM_CSS } from "./_components/LandingStyles";
import HeaderBar from "./_components/HeaderBar";
import HeroSection from "./_components/HeroSection";
import PricingSection from "./_components/PricingSection";
import PackageIncludes from "./_components/PackageIncludes";
import PaymentSteps from "./_components/PaymentSteps";
import TrainingRoadmap from "./_components/TrainingRoadmap";
import UpgradeProcess from "./_components/UpgradeProcess";
import PostEnrollRoadmap from "./_components/PostEnrollRoadmap";
import ToolsHub from "./_components/ToolsHub";
import LeadForm from "./_components/LeadForm";
import FooterCTA from "./_components/FooterCTA";
import BottomNav from "./_components/BottomNav";

export default function LandingPage() {
    const [activeNav, setActiveNav] = useState("hero");
    const [showStickyCta, setShowStickyCta] = useState(false);
    const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

    /* Theo dõi section đang xem */
    useEffect(() => {
        const obs = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => { if (e.isIntersecting) setActiveNav(e.target.id); });
            },
            { rootMargin: "-40% 0px -55% 0px" }
        );
        Object.values(sectionRefs.current).forEach((el) => { if (el) obs.observe(el); });
        return () => obs.disconnect();
    }, []);

    /* Sticky CTA */
    useEffect(() => {
        const onScroll = () => setShowStickyCta(window.scrollY > 500);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    /* Cuộn đến section */
    function scrollTo(id: string) {
        sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    return (
        <div className="min-h-screen bg-white">
            <style dangerouslySetInnerHTML={{ __html: ANIM_CSS }} />

            <HeaderBar />

            {/* pt-[52px] = chiều cao header fixed */}
            <main className="pt-[52px] pb-[88px] md:pb-0">
                <div ref={(el) => { sectionRefs.current.hero = el; }} id="hero">
                    <HeroSection scrollTo={scrollTo} />
                </div>

                <div ref={(el) => { sectionRefs.current.pricing = el; }} id="pricing">
                    <PricingSection scrollTo={scrollTo} />
                </div>

                <PackageIncludes />

                <PaymentSteps scrollTo={scrollTo} />

                <div ref={(el) => { sectionRefs.current.roadmap = el; }} id="roadmap">
                    <TrainingRoadmap />
                </div>

                <UpgradeProcess scrollTo={scrollTo} />

                <PostEnrollRoadmap />

                <div ref={(el) => { sectionRefs.current.tools = el; }} id="tools">
                    <ToolsHub />
                </div>

                <div ref={(el) => { sectionRefs.current["dang-ky"] = el; }} id="dang-ky">
                    <LeadForm />
                </div>

                <FooterCTA scrollTo={scrollTo} />

                <footer className="border-t border-slate-200/60 bg-white py-6 text-center text-xs text-slate-400">
                    © {new Date().getFullYear()} Đào Tạo Lái Xe Thầy Duy. Mọi quyền được bảo lưu.
                </footer>
            </main>

            {/* Nút CTA nổi */}
            <div
                className={`fixed bottom-16 left-0 right-0 z-40 flex justify-center transition-all duration-300 md:bottom-4 ${showStickyCta ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
                    }`}
            >
                <button
                    onClick={() => scrollTo("dang-ky")}
                    className="ld-pulse rounded-full bg-amber-500 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.97]"
                >
                    🚗 ĐĂNG KÝ NGAY
                </button>
            </div>

            <BottomNav activeNav={activeNav} scrollTo={scrollTo} />
        </div>
    );
}
