"use client";

import { Button, ButtonLink } from "@/ui/button";
import { StrayScreen } from "@/ui/stray-screen";

/** A page that crashed while rendering: the shell around it still stands. */
export default function ErrorPage({
  retry,
}: {
  readonly error: unknown;
  readonly retry: () => void;
}) {
  return (
    <StrayScreen
      title="Une erreur est survenue."
      text="Recharge la page. Si ça recommence, écris-nous."
    >
      <Button onClick={retry}>Recharger la page</Button>
      <ButtonLink href="/" variant="secondary">
        Revenir à l'accueil
      </ButtonLink>
    </StrayScreen>
  );
}
