import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { ThemeProvider, themeInitScript } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { isClerkConfigured } from "@/lib/authConfig";

export const metadata: Metadata = {
  title: "Stride Lab | Running Motion Analysis",
  description: "Browser-based running motion analysis using pose landmarks and image-space measurements.",
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
