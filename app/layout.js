import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
  preload: true,
});

export const metadata = {
  title: "CB Pro",
  description: "Hệ Thống Quản Lý Nội Bộ CB Pro",
  charset: "utf-8",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 0.25,
  maximumScale: 6.0,
  userScalable: true,
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="vi"
      className={`${beVietnamPro.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
