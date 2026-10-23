import type { Metadata } from "next";
import { ButtonLink } from "@/ui/button";
import { StrayScreen } from "@/ui/stray-screen";

export const metadata: Metadata = { title: "Page introuvable · Leximon" };

export default function NotFound() {
  return (
    <StrayScreen title="Ce rayon n'existe pas." text="L'adresse est fausse, ou la page a déménagé.">
      <ButtonLink href="/jouer">Ouvrir un sachet</ButtonLink>
      <ButtonLink href="/" variant="secondary">
        Revenir à l'accueil
      </ButtonLink>
    </StrayScreen>
  );
}
