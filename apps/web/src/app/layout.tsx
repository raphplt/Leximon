import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leximon",
  description: "Collectionne les mots que la langue a oubliés.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
