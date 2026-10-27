import type { Metadata } from "next";
import { LandingPage } from "@/landing/landing-page";

const DESCRIPTION =
  "Un jeu de cartes à collectionner où chaque carte est un mot oublié du français.";

export const metadata: Metadata = {
  title: "Leximon · Le jeu de cartes des mots oubliés",
  description: DESCRIPTION,
  openGraph: {
    title: "Leximon",
    description: DESCRIPTION,
    siteName: "Leximon",
    locale: "fr_FR",
    type: "website",
  },
};

export default function Home() {
  return <LandingPage />;
}
