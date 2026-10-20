"use client";

import { useEffect, useState } from "react";
import {
  PACK_NOUNS,
  PACK_SHAPE,
  type PackNoun,
  type PackShape,
  packShapeFromSearch,
} from "./pack-shape";

const TRY_KEY = "leximon.paquet";

/** A shape asked for in the address is kept for the visit, so that every screen agrees. */
function shapeToTry(): PackShape | null {
  const asked = packShapeFromSearch(window.location.search);
  try {
    if (asked !== null) window.sessionStorage.setItem(TRY_KEY, asked);
    return asked ?? packShapeFromSearch(`?paquet=${window.sessionStorage.getItem(TRY_KEY)}`);
  } catch {
    return asked;
  }
}

export interface PackShapeState {
  readonly shape: PackShape;
  readonly noun: PackNoun;
  /** `false` until read in the browser: a screen that shows the pack waits for it. */
  readonly known: boolean;
}

/** The pack shape shown (P47) and its word (P53): the one in force, or the one being tried. */
export function usePackShape(): PackShapeState {
  const [state, setState] = useState({ shape: PACK_SHAPE, known: false });
  useEffect(() => {
    setState({ shape: shapeToTry() ?? PACK_SHAPE, known: true });
  }, []);
  return { ...state, noun: PACK_NOUNS[state.shape] };
}
