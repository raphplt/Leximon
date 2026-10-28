"use client";

import { cssRootRule } from "@leximon/tokens";
import { Button } from "@/ui/button";
import { StrayScreen } from "@/ui/stray-screen";
import "./globals.css";

/** The root layout itself crashed: this page brings its own document, without the fonts. */
export default function GlobalError({
  retry,
}: {
  readonly error: unknown;
  readonly retry: () => void;
}) {
  return (
    <html lang="fr">
      <head>
        <title>Leximon</title>
        <style>{cssRootRule()}</style>
      </head>
      <body>
        <StrayScreen title="Cette page a planté." text="Recharge-la. Si ça recommence, écris-nous.">
          <Button onClick={retry}>Recharger la page</Button>
        </StrayScreen>
      </body>
    </html>
  );
}
