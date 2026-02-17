import type { Metadata, Viewport } from "next";
import { APP_NAME } from "@/lib/app-meta";

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
            {children}
        </>
    );
}
