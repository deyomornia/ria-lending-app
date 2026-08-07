import type { Metadata } from "next";
import {
  Atkinson_Hyperlegible,
  Bricolage_Grotesque,
  Geist_Mono,
} from "next/font/google";
import "./globals.css";

// Atkinson Hyperlegible is designed by the Braille Institute for maximum
// legibility — ideal for senior and low-vision readers.
const atkinson = Atkinson_Hyperlegible({
  variable: "--font-sans-readable",
  weight: ["400", "700"],
  subsets: ["latin"],
});

// Display face for headings, figures, and buttons. Tight apertures and a wide
// weight range give the product a voice without hurting the reading text.
const bricolage = Bricolage_Grotesque({
  variable: "--font-display-grotesque",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RIA Lending",
  description:
    "Loan management for Philippine lending companies — calculator, agreements, and loan monitoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${atkinson.variable} ${bricolage.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
