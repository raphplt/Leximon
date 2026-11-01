import { colors, cssRootRule } from "@leximon/tokens";
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Fraunces, Newsreader } from "next/font/google";
import { Umami } from "@/analytics/umami";
import { SourceCapture } from "@/beta/source-capture";
import "./globals.css";

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
  variable: "--font-display",
});
const ui = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-ui" });
const text = Newsreader({ subsets: ["latin"], style: "normal", variable: "--font-text" });
// The same family name, so `--font-text` gets its italic from here. Only quotes use it: it is not
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
