import type { Metadata, Viewport } from "next";
import { Inter, Figtree } from "next/font/google";
import { ThemeProvider } from "next-themes";

import "./globals.css";
import { NetworkProvider } from "@/lib/network-provider";
import { Shell } from "@/components/Shell";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-inter",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-figtree",
});

export const metadata: Metadata = {
  title: {
    template: "%s | QoreChain Explorer",
    default: "QoreChain Explorer",
  },
  description:
    "Public block explorer for QoreChain — blocks, transactions, validators and accounts across the Cosmos, EVM and SVM lanes, on mainnet (qorechain-vladi) and testnet (qorechain-diana).",
  keywords: ["QoreChain", "block explorer", "blockchain", "QOR", "post-quantum"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${figtree.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="theme"
        >
          <NetworkProvider>
            <Shell>{children}</Shell>
          </NetworkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
