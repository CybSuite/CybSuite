import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServerNavigation } from './components/navigation/ServerNavigation';
import { ServerSidebar } from './components/navigation/ServerSidebar';
import { NuqsAdapter } from "nuqs/adapters/next/app";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CybSuite",
  description: "Cybersecurity Suite - Professional security testing and review platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <NuqsAdapter>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <div className="min-h-screen bg-background">
            {/* Navigation Bar */}
            <ServerNavigation />

            {/* Main Content Area */}
            <div className="flex">
              {/* Sidebar */}
              <ServerSidebar />

              {/* Main Content */}
              <main className="flex-1 overflow-auto">
                <div className="container mx-auto py-6 px-4">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </body>
      </html>
    </NuqsAdapter>
  );
}
