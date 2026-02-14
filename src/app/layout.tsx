import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ThayDuy CRM",
  description: "Hệ thống CRM ThayDuy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
