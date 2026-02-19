import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { APP_NAME } from "@/lib/app-meta";
import { TrackingScripts, TrackingScriptsBottom } from "./_components/TrackingScripts";

export const metadata: Metadata = {
    title: `${APP_NAME} – Đào Tạo Lái Xe Uy Tín`,
    description:
        "Đăng ký học lái xe ô tô, xe máy giá tốt. Lịch học linh hoạt, hỗ trợ thi, cam kết đậu. Đào tạo lái xe Thầy Duy.",
    openGraph: {
        title: `${APP_NAME} – Đào Tạo Lái Xe Uy Tín`,
        description:
            "Đăng ký học lái xe ô tô, xe máy giá tốt. Lịch học linh hoạt, hỗ trợ thi, cam kết đậu.",
        type: "website",
    },
};

export const viewport: Viewport = {
    themeColor: "#F5A623",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
};

export default function LandingLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <>
            {/* Meta Pixel Code */}
            <Script id="meta-pixel" strategy="afterInteractive">{`
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '1352480913314806');
                fbq('track', 'PageView');
            `}</Script>
            <noscript>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img height="1" width="1" style={{ display: "none" }}
                    src="https://www.facebook.com/tr?id=1352480913314806&ev=PageView&noscript=1"
                    alt="" />
            </noscript>

            <TrackingScripts site="LANDING" />
            {children}
            <TrackingScriptsBottom site="LANDING" />
        </>
    );
}

