import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "SummitHack",
  description: "SummitHack starter",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="flex min-h-full flex-col">
        <header className="border-b">
          <div className="mx-auto w-full max-w-5xl px-6 py-4 font-semibold">
            SummitHack
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
