import type { Metadata } from "next";
import { Noto_Sans_SC, Space_Grotesk } from "next/font/google";
import "./globals.css";

const fontCn = Noto_Sans_SC({
  variable: "--font-cn",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const fontDisplay = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FBIF RSS 情报中心",
  description: "可部署在阿里云的飞书登录 RSS 行业情报平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${fontCn.variable} ${fontDisplay.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
