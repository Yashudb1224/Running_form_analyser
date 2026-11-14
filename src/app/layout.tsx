import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { ThemeProvider, themeInitScript } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { isClerkConfigured } from "@/lib/authConfig";

export const metadata: Metadata = {
  title: "Stride Lab | Running Motion Analysis",
  description: "Browser-based running motion analysis using pose landmarks and image-space measurements.",
  applicationName: "Stride Lab",
  icons: {
    icon: [{ url: "/icons/favicon-64.png", sizes: "64x64", type: "image/png" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Stride Lab", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d121b" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const page = (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased min-h-screen bg-background text-body">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
  // Without Clerk keys the app runs without sign-in.
  return isClerkConfigured() ? <ClerkProvider>{page}</ClerkProvider> : page;
}
