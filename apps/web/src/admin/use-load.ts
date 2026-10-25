"use client";

import { useCallback, useEffect, useState } from "react";
import { adminErrorMessage } from "@/admin/admin-api";

export type Loaded<T> =
  | { readonly kind: "loading" }
  | { readonly kind: "failed"; readonly message: string }
  | { readonly kind: "ready"; readonly data: T };

/** Loads `fetcher` on mount and whenever it changes; `reload` fetches again. */
export function useLoad<T>(fetcher: () => Promise<T>): {
  readonly state: Loaded<T>;
  readonly reload: () => void;
} {
  const [state, setState] = useState<Loaded<T>>({ kind: "loading" });
  const reload = useCallback(() => {
    let live = true;
    fetcher()
      .then((data) => {
        if (live) setState({ kind: "ready", data });
      })
      .catch((error: unknown) => {
        if (live) setState({ kind: "failed", message: adminErrorMessage(error) });
      });
    return () => {
      live = false;
    };
  }, [fetcher]);
  useEffect(() => reload(), [reload]);
  return { state, reload: () => void reload() };
}
