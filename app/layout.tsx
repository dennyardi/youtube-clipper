import type { Metadata } from "next";
import { AppSidebar } from "@/components/app-sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Youtube Clipper Maker",
  description: "Dashboard otomatisasi analisis dan pemotongan clip YouTube.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <div className="flex min-h-screen">
          <AppSidebar />
          <main className="min-w-0 flex-1 px-5 py-5 lg:px-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
