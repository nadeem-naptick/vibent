import type { Metadata, Viewport } from "next";
import { Inter, Roboto_Mono, Public_Sans } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

// Public Sans — used by the marketing landing page. Loaded via next/font so
// the font is inlined at build time and there's no FOUC / metric-shift on
// first paint (which made everything look "compressed" before the font
// arrived from Google).
const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-public-sans",
});

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Agentic Collaboration Room",
  description:
    "A live execution workspace where teams discuss, decide, and watch the product artifact take shape in real time.",
  robots: "noindex, nofollow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${publicSans.variable} ${geistSans.variable} ${geistMono.variable} ${robotoMono.variable} font-sans`}>
        {children}
        <Toaster
          theme="dark"
          position="top-center"
          offset="92px"
          richColors
          toastOptions={{
            style: {
              background: 'rgba(11, 15, 20, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
            },
          }}
        />
      </body>
    </html>
  );
}
