import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Running Form & Performance Analyzer",
  description: "Markerless Computer Vision Pose Estimation & Biomechanical Telemetry Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-background text-slate-100">
        {children}
      </body>
    </html>
  );
}
