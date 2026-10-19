import { cssRootRule } from "@leximon/tokens";
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Fraunces, Newsreader } from "next/font/google";
import { NavBar } from "@/components/nav-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leximon",
  description: "Collectionne les mots que la langue a oubliés.",
};

export const viewport: Viewport = {
  themeColor: "#262B40",
};

// Font families come from D-022 (`fonts` in @leximon/tokens); next/font serves them ourselves.
const display = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
  variable: "--font-display",
});
const ui = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-ui" });
const text = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-text",
});

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${display.variable} ${ui.variable} ${text.variable}`}>
      <head>
        <style>{cssRootRule()}</style>
      </head>
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
