import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/layout/site-header";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "StellarPay — Cross-Chain Lending on Stellar",
  description: "Wrap tokens from any chain and lend on Stellar. Real-time cross-chain settlement, automated liquidations.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "StellarPay",
    description: "Decentralized cross-chain lending protocol on Stellar",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased min-h-screen`}>
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-border/40 py-8 text-sm text-muted-foreground">
              <div className="container flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
                <p>© 2026 StellarPay. Built on Stellar.</p>
                <p>
                  Powered by Soroban · Horizon ·{" "}
                  <a className="hover:text-primary" href="https://github.com/stellar-payment-gateway/stellar-payment-gateway-sdk-main">GitHub</a>
                </p>
              </div>
            </footer>
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
