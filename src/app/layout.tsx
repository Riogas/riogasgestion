import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner"; // 👈 importante
import LogRocketInit from "@/components/LogRocketInit";
import "./globals.css";
import { LoadingProvider } from "@/lib/LoadingContext";
import GlobalLoader from "@/components/GlobalLoader";
import { GlobalLoadingOverlay } from "@/lib/GlobalLoadingOverlay";
import QueryProvider from "@/components/providers/QueryProvider";
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
  title: "Riogas GOYA",
  description: "Sistema de Gestión",
  icons: {
    icon: '/favicon.ico', // Ruta al favicon en la carpeta public
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
};

// Anti-flash: applies the .dark class before React renders, based on the
// stored theme preference. Keep this script in sync with src/lib/useTheme.ts.
const themeScript = `
  (function() {
    try {
      var key = 'goya:theme';
      var legacy = 'theme';
      var stored = localStorage.getItem(key);
      if (stored !== 'light' && stored !== 'dark' && stored !== 'system') {
        var lg = localStorage.getItem(legacy);
        stored = (lg === 'light' || lg === 'dark') ? lg : 'system';
      }
      var resolved = stored;
      if (stored === 'system') {
        resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      if (resolved === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <LogRocketInit />
        <NuqsAdapter>
          <QueryProvider>
            <LoadingProvider>
              {children}
              <GlobalLoadingOverlay />
            </LoadingProvider>
          </QueryProvider>
        </NuqsAdapter>
        <Toaster /> {/* sonner toaster (config interna usa glass + tokens) */}
      </body>
    </html>
  );
}
