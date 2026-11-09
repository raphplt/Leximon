import { colors, cssRootRule } from "@leximon/tokens";
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Fraunces, Newsreader } from "next/font/google";
import { Umami } from "@/analytics/umami";
import { SourceCapture } from "@/beta/source-capture";
import "./globals.css";
// Shared pieces' base rules must come before every module that restyles a piece, as they do in
// development. The production build orders shared CSS chunks on its own: a piece's rule could land
// after a page's and win, or the reverse. Loaded here, they always come first, in this order.
import "@/ui/toy.module.css";
import "@/ui/ui.module.css";
import "@/ui/ornaments.module.css";
import "@/ui/logo.module.css";
import "@/ui/gain-banner.module.css";
import "@/library/sachet.module.css";
import "@/library/play-pieces.module.css";

export const metadata: Metadata = {
  // Shared images (`opengraph-image.tsx`) need absolute URLs.
  metadataBase: new URL("https://leximon.fr"),
  title: "Leximon",
  description: "Les mots oubliés du français, en cartes à collectionner.",
  twitter: { card: "summary_large_image" },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: colors.page,
};

// Font families come from `fonts` in @leximon/tokens; next/font serves them ourselves.
const display = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
  variable: "--font-fraunces",
});
const ui = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });
const text = Newsreader({ subsets: ["latin"], style: "normal", variable: "--font-newsreader" });
// The same family name, so `--font-newsreader` gets its italic from here. Only quotes use it: it is not
// preloaded with the fonts of the first screen.
const textItalic = Newsreader({
  subsets: ["latin"],
  style: "italic",
  variable: "--font-text-italic",
  preload: false,
});

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${display.variable} ${ui.variable} ${text.variable} ${textItalic.variable}`}
    >
      <head>
        <style>{cssRootRule()}</style>
      </head>
      <body>
        {children}
        <SourceCapture />
        <Umami />
      </body>
    </html>
  );
}
