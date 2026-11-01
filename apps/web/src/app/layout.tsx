import { colors, cssRootRule } from "@leximon/tokens";
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Fraunces, Newsreader } from "next/font/google";
import localFont from "next/font/local";
import { Umami } from "@/analytics/umami";
import { SourceCapture } from "@/beta/source-capture";
import { LOOK_SCRIPT } from "@/theme/look";
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

// The fonts of Le Livre, which only its pages ask for: the current look does not download them.
const bookText = localFont({
  src: [
    { path: "../theme/fonts/Spectral-Regular.woff2", weight: "400", style: "normal" },
    { path: "../theme/fonts/Spectral-Italic.woff2", weight: "400", style: "italic" },
    { path: "../theme/fonts/Spectral-Medium.woff2", weight: "500", style: "normal" },
    { path: "../theme/fonts/Spectral-SemiBold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-spectral",
  preload: false,
});
const bookTitle = localFont({
  src: [
    { path: "../theme/fonts/LeximonCanon-Regular.woff2", weight: "400", style: "normal" },
    { path: "../theme/fonts/LeximonCanon-Italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-canon",
  preload: false,
});

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      // The look and the theme are set before React starts: they are not for it to reconcile.
      suppressHydrationWarning
      className={`${display.variable} ${ui.variable} ${text.variable} ${textItalic.variable} ${bookText.variable} ${bookTitle.variable}`}
    >
      <head>
        <style>{cssRootRule()}</style>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant, without any input */}
        <script dangerouslySetInnerHTML={{ __html: LOOK_SCRIPT }} />
      </head>
      <body>
        {children}
        <SourceCapture />
        <Umami />
      </body>
    </html>
  );
}
