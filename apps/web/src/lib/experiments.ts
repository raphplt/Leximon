"use client";

import type { ExperimentsResponse } from "@leximon/contract";
import { useEffect, useState } from "react";
import { fetchExperiments } from "./api";
import {
  choosePackShape,
  PACK_NOUNS,
  type PackNoun,
  type PackShape,
  packShapeFromSearch,
} from "./pack-shape";

let loading: Promise<ExperimentsResponse["variants"] | null> | null = null;

/**
 * The player's A/B variants, fetched once per page load and shared by every screen. `null` when
 * they cannot be read: the player then sees the control, the game goes on.
 */
export function loadExperiments(): Promise<ExperimentsResponse["variants"] | null> {
  loading ??= fetchExperiments().catch(() => {
    loading = null;
    return null;
  });
  return loading;
}

const PREVIEW_KEY = "leximon.paquet";

/** A preview asked for in the address is kept for the visit, so that every screen agrees. */
function readPreview(): PackShape | null {
  const asked = packShapeFromSearch(window.location.search);
  try {
    if (asked !== null) window.sessionStorage.setItem(PREVIEW_KEY, asked);
    return asked ?? packShapeFromSearch(`?paquet=${window.sessionStorage.getItem(PREVIEW_KEY)}`);
  } catch {
    return asked;
  }
}

export interface PackShapeState {
  readonly shape: PackShape;
  readonly noun: PackNoun;
  /** `false` until the variant is known: a screen that shows the pack waits for it. */
  readonly known: boolean;
}

/** The pack shape this player sees (P47) and the word that goes with it (P53). */
export function usePackShape(): PackShapeState {
  const [state, setState] = useState<{ shape: PackShape; known: boolean }>({
    shape: "pli",
    known: false,
  });
  useEffect(() => {
    const preview = readPreview();
    if (preview !== null) {
      setState({ shape: preview, known: true });
      return;
    }
    let cancelled = false;
    void loadExperiments().then((variants) => {
      if (!cancelled) setState({ shape: choosePackShape(null, variants), known: true });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return { ...state, noun: PACK_NOUNS[state.shape] };
}
