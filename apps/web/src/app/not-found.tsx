import type { Metadata } from "next";
import { ButtonLink } from "@/ui/button";
import { StrayScreen } from "@/ui/stray-screen";

export const metadata: Metadata = { title: "Page introuvable · Leximon" };

export default function NotFound() {
  return (
    <StrayScreen title="Cette page n'existe pas." text="Vérifie l'adresse, ou repars de l'accueil.">
      <ButtonLink href="/jouer">Ouvrir un sachet</ButtonLink>
      <ButtonLink href="/" variant="secondary">
        Revenir à l'accueil
      </ButtonLink>
    </StrayScreen>
  );
}
