import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stride Lab | Running Motion Analysis",
  description: "Browser-based running motion analysis using pose landmarks and image-space measurements.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-background text-slate-800">
        {children}
      </body>
    </html>
  );
}
