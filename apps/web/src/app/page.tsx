import type { Metadata } from "next";
import { LandingPage } from "@/landing/landing-page";

const DESCRIPTION =
  "Un jeu de cartes à collectionner pour découvrir les mots rares et anciens du français. Inscris-toi pour être prévenu de l'ouverture.";

export const metadata: Metadata = {
  title: "Leximon · Collectionne les mots que la langue a oubliés",
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
