"use client";

import { useEffect, useState } from "react";
import { Button } from "@/ui/button";

/** Read by the Umami script before each event: any value stops the counting in this browser. */
const DISABLED_KEY = "umami.disabled";

function isCounted(): boolean {
  try {
    return window.localStorage.getItem(DISABLED_KEY) === null;
  } catch {
    return true;
  }
}

function setCounted(counted: boolean): boolean {
  try {
    if (counted) window.localStorage.removeItem(DISABLED_KEY);
    else window.localStorage.setItem(DISABLED_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/** Lets a visitor stop, then restart, the counting of their visits in this browser. */
export function AnalyticsOptOut() {
  // Unknown until the browser is read, so the server render shows no button.
  const [counted, setCountedState] = useState<boolean | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => setCountedState(isCounted()), []);

  if (counted === null) return null;
  if (blocked) {
    return <p>Ton navigateur bloque le stockage local, donc ce choix ne peut pas être gardé.</p>;
  }
  return (
    <>
      <p>
        {counted
          ? "Tes visites sont comptées sur ce navigateur."
          : "Tes visites ne sont plus comptées sur ce navigateur."}
      </p>
      <Button
        variant="secondary"
        small
        onClick={() => {
          if (setCounted(!counted)) setCountedState(!counted);
          else setBlocked(true);
        }}
      >
        {counted ? "Ne plus compter mes visites" : "Compter à nouveau mes visites"}
      </Button>
    </>
  );
}
