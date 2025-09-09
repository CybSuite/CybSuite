import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UnifiedServerNavigation, UnifiedServerSidebar } from './components/navigation/UnifiedServerNavigation';
import { NavigationRoutesProvider } from './components/navigation/NavigationRoutesProvider';
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
          <NavigationRoutesProvider>
            <div className="min-h-screen bg-background">
              {/* Navigation Bar */}
              <UnifiedServerNavigation />

              {/* Main Content Area */}
              <div className="flex">
                {/* Sidebar */}
                <UnifiedServerSidebar />

                {/* Main Content */}
                <main className="flex-1 overflow-auto">
                  <div className="container mx-auto py-6 px-4">
                    {children}
                    <div id="combobox-portal-container"></div>
                  </div>
                </main>
              </div>
            </div>
          </NavigationRoutesProvider>
        </body>
      </html>
    </NuqsAdapter>
  );
}
