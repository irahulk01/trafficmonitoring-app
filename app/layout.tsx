import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PWAProvider } from "@/lib/pwa-context";

export const metadata: Metadata = {
  title: "Live Traffic Congestion Dashboard | TrafficFlow",
  description: "Real-time AI-powered traffic flow telemetry, TomTom vector map and congestion incident detection.",
  manifest: "/manifest.json",
  applicationName: "TrafficFlow",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TrafficFlow",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b0f19",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-touch-fullscreen" content="yes" />
      </head>
      <body
        suppressHydrationWarning
        className="antialiased bg-[#0b0f19] text-gray-100 min-h-screen selection:bg-cyan-500/30"
      >
        <PWAProvider>
          {children}
        </PWAProvider>
      </body>
    </html>
  );
}

