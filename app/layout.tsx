import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter"
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

export const metadata: Metadata = {
  title: "Vibe for Enterprises - AI Website Builder",
  description: "Transform any website into a modern, responsive design in seconds with our enterprise-grade AI-powered website builder. Perfect for businesses and agencies.",
  keywords: "AI website builder, enterprise web design, website transformation, responsive design, business website builder",
  authors: [{ name: "Vibe for Enterprises" }],
  viewport: "width=device-width, initial-scale=1",
  robots: "index, follow",
  openGraph: {
    title: "Vibe for Enterprises - AI Website Builder",
    description: "Transform any website into a modern, responsive design in seconds with our enterprise-grade AI-powered website builder.",
    type: "website",
    locale: "en_US"
  },
  twitter: {
    card: "summary_large_image",
    title: "Vibe for Enterprises - AI Website Builder",
    description: "Transform any website into a modern, responsive design in seconds with our enterprise-grade AI-powered website builder."
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} ${robotoMono.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
