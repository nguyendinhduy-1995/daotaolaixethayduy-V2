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
            {/* _fbc cookie from fbclid + ViewContent event */}
            <Script id="meta-fbc-viewcontent" strategy="afterInteractive">{`
                (function(){
                    // Set _fbc cookie if fbclid present
                    try {
                        var url = new URL(window.location.href);
                        var fbclid = url.searchParams.get('fbclid');
                        if (fbclid && !document.cookie.match(/(^|;\\s*)_fbc=/)) {
                            var fbc = 'fb.1.' + Date.now() + '.' + fbclid;
                            var exp = new Date(Date.now() + 90*24*60*60*1000).toUTCString();
                            document.cookie = '_fbc=' + fbc + '; path=/; expires=' + exp + '; SameSite=Lax';
                        }
                    } catch(e) {}
                    // Fire ViewContent for CAPI dedup
                    var eid = (crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now()+'-'+Math.random().toString(36).slice(2,10);
                    if (typeof fbq !== 'undefined') fbq('track', 'ViewContent', {content_name: document.title}, {eventID: eid});
                    fetch('/api/meta/capi', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({event_name:'ViewContent',event_id:eid,event_source_url:window.location.href}), keepalive:true}).catch(function(){});
                })();
            `}</Script>
            {/* Contact event for tel/zalo clicks */}
            <Script id="meta-contact-events" strategy="afterInteractive">{`
                document.addEventListener('click', function(e) {
                    var a = e.target.closest && e.target.closest('a[href]');
                    if (!a) return;
                    var href = a.getAttribute('href') || '';
                    var isTel = href.startsWith('tel:');
                    var isZalo = href.includes('zalo');
                    if (!isTel && !isZalo) return;
                    var eid = (crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now()+'-'+Math.random().toString(36).slice(2,10);
                    var contactType = isTel ? 'phone' : 'zalo';
                    if (typeof fbq !== 'undefined') fbq('track', 'Contact', {content_name: contactType, content_category: 'landing'}, {eventID: eid});
                    fetch('/api/meta/capi', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({event_name:'Contact',event_id:eid,event_source_url:window.location.href,custom_data:{content_name:contactType}}), keepalive:true}).catch(function(){});
                });
            `}</Script>
            <noscript>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img height="1" width="1" style={{ display: "none" }}
                    src="https://www.facebook.com/tr?id=1352480913314806&ev=PageView&noscript=1"
                    alt="" />
            </noscript>

            {/* Google Analytics (gtag.js) */}
            <Script
                src="https://www.googletagmanager.com/gtag/js?id=G-Y66W00G0HS"
                strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">{`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', 'G-Y66W00G0HS');
            `}</Script>

            {/* Analytics Tracker — Thầy Duy internal */}
            <Script src="/analytics-tracker-landing.js" strategy="afterInteractive" />

            <TrackingScripts site="LANDING" />
            {children}
            <TrackingScriptsBottom site="LANDING" />
        </>
    );
}

