"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/ui/button";
import { StrayScreen } from "@/ui/stray-screen";

/** A page that crashed while rendering: the shell around it still stands. */
export default function ErrorPage({
  error,
  retry,
}: {
  readonly error: unknown;
  readonly retry: () => void;
}) {
  // The screen tells the player nothing of the cause: the console keeps it for whoever looks.
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <StrayScreen title="Cette page a planté." text="Recharge-la. Si ça recommence, écris-nous.">
      <Button onClick={retry}>Recharger la page</Button>
      <ButtonLink href="/" variant="secondary">
        Revenir à l'accueil
      </ButtonLink>
    </StrayScreen>
  );
}
