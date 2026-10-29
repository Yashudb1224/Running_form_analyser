import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Running Form & Performance Analyzer",
  description: "Browser-side pose tracking and exploratory running-form telemetry dashboard",
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
