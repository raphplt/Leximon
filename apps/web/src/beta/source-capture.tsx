"use client";

import { useEffect } from "react";
import { rememberSource } from "./arrival-store";

/** Notes the `?src=` of the first link a visitor opens, on whatever page it leads to. */
export function SourceCapture() {
  useEffect(() => {
    rememberSource(window.location.search);
  }, []);
  return null;
}
