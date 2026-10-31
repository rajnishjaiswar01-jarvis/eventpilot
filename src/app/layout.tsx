import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "EventPilot",
  description: "Adaptive Event Intelligence Platform",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex font-sans bg-background text-foreground">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
